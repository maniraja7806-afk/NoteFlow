import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setIO(instance: SocketIOServer): void {
  io = instance;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export const noteRoom = (noteId: string): string => `note:${noteId}`;

/**
 * Broadcast an updated note to everyone currently in its room. Safe to call
 * from REST controllers even before Socket.IO is initialised.
 */
export function emitNoteUpdate(noteId: string, payload: unknown, event = 'broadcast-update'): void {
  io?.to(noteRoom(noteId)).emit(event, payload);
}
