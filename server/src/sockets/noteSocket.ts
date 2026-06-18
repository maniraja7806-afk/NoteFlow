import { Server as SocketIOServer, Socket } from 'socket.io';
import { Note } from '../models/Note';
import { resolveAccess } from '../middleware/accessControl';
import { authenticateToken } from '../middleware/auth';
import { User } from '../models/User';
import { sanitizeHtml, sanitizePlainText } from '../utils/sanitize';
import { noteRoom, setIO } from './io';

interface PresenceUser {
  userId: string;
  username: string;
  avatar: string;
  socketId: string;
}

// roomName -> list of present users
const presence = new Map<string, PresenceUser[]>();
// noteId -> debounce timer for persisting socket edits (Last Write Wins)
const saveTimers = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 1200;

interface SocketData {
  userId: string;
  username: string;
  avatar: string;
}

function addPresence(room: string, user: PresenceUser): PresenceUser[] {
  const list = presence.get(room) ?? [];
  // De-duplicate by userId (a user may have multiple tabs).
  const filtered = list.filter((u) => u.socketId !== user.socketId);
  filtered.push(user);
  presence.set(room, filtered);
  return filtered;
}

function removePresenceBySocket(socketId: string): void {
  for (const [room, list] of presence.entries()) {
    const next = list.filter((u) => u.socketId !== socketId);
    if (next.length > 0) {
      presence.set(room, next);
    } else {
      presence.delete(room);
    }
  }
}

function uniqueUsers(list: PresenceUser[]): Omit<PresenceUser, 'socketId'>[] {
  const map = new Map<string, Omit<PresenceUser, 'socketId'>>();
  for (const u of list) {
    map.set(u.userId, { userId: u.userId, username: u.username, avatar: u.avatar });
  }
  return Array.from(map.values());
}

function scheduleSave(noteId: string, userId: string, data: { title?: string; content?: string }): void {
  const existing = saveTimers.get(noteId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    saveTimers.delete(noteId);
    try {
      const note = await Note.findById(noteId);
      if (!note || note.isDeleted) return;
      if (data.title !== undefined) note.title = sanitizePlainText(data.title) || 'Untitled';
      if (data.content !== undefined) note.content = sanitizeHtml(data.content);
      note.lastEditedBy = note.owner; // placeholder; refined below
      try {
        note.set('lastEditedBy', userId);
      } catch {
        /* invalid id ignored */
      }
      await note.save();
    } catch (err) {
      console.error('[socket] debounced save failed:', err);
    }
  }, SAVE_DEBOUNCE_MS);

  saveTimers.set(noteId, timer);
}

export function registerSocketHandlers(io: SocketIOServer): void {
  setIO(io);

  // Authenticate every socket connection via the handshake token.
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.replace('Bearer ', '') as string | undefined);
      if (!token) {
        return next(new Error('Authentication token missing'));
      }
      const userId = await authenticateToken(token);
      const user = await User.findById(userId).lean();
      if (!user) return next(new Error('User not found'));

      const data = socket.data as SocketData;
      data.userId = userId;
      data.username = user.username;
      data.avatar = user.avatar;
      return next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on('join-note', async (noteId: string) => {
      try {
        const note = await Note.findById(noteId).select('owner sharedWith isDeleted').lean();
        if (!note || note.isDeleted) {
          socket.emit('error-message', { message: 'Note not found' });
          return;
        }
        if (!resolveAccess(note, data.userId)) {
          socket.emit('error-message', { message: 'Access denied' });
          return;
        }

        const room = noteRoom(noteId);
        socket.join(room);

        const presenceUser: PresenceUser = {
          userId: data.userId,
          username: data.username,
          avatar: data.avatar,
          socketId: socket.id,
        };
        const list = addPresence(room, presenceUser);

        // Tell the joiner who is already here.
        socket.emit('presence', { noteId, users: uniqueUsers(list) });
        // Tell everyone else someone joined.
        socket.to(room).emit('user-joined', {
          noteId,
          user: { userId: data.userId, username: data.username, avatar: data.avatar },
          users: uniqueUsers(list),
        });
      } catch (err) {
        console.error('[socket] join-note error:', err);
        socket.emit('error-message', { message: 'Failed to join note' });
      }
    });

    socket.on('leave-note', (noteId: string) => {
      const room = noteRoom(noteId);
      socket.leave(room);
      removePresenceBySocket(socket.id);
      socket.to(room).emit('user-left', {
        noteId,
        userId: data.userId,
        users: uniqueUsers(presence.get(room) ?? []),
      });
    });

    // Debounced collaborative edit. Broadcasts immediately (optimistic) and
    // persists to Mongo with Last-Write-Wins semantics.
    socket.on(
      'edit-note',
      (payload: { noteId: string; title?: string; content?: string; tags?: string[]; color?: string }) => {
        const { noteId } = payload ?? {};
        if (!noteId) return;
        const room = noteRoom(noteId);

        socket.to(room).emit('broadcast-update', {
          noteId,
          title: payload.title,
          content: payload.content,
          tags: payload.tags,
          color: payload.color,
          by: { userId: data.userId, username: data.username, avatar: data.avatar },
          at: Date.now(),
        });

        scheduleSave(noteId, data.userId, { title: payload.title, content: payload.content });
      }
    );

    // Lightweight cursor/typing presence relay (no persistence).
    socket.on('cursor', (payload: { noteId: string; cursor: unknown }) => {
      if (!payload?.noteId) return;
      socket.to(noteRoom(payload.noteId)).emit('cursor', {
        userId: data.userId,
        username: data.username,
        cursor: payload.cursor,
      });
    });

    socket.on('disconnect', () => {
      // Notify all rooms this socket was part of.
      for (const [room, list] of presence.entries()) {
        if (list.some((u) => u.socketId === socket.id)) {
          const next = list.filter((u) => u.socketId !== socket.id);
          socket.to(room).emit('user-left', {
            noteId: room.replace(/^note:/, ''),
            userId: data.userId,
            users: uniqueUsers(next),
          });
        }
      }
      removePresenceBySocket(socket.id);
    });
  });
}
