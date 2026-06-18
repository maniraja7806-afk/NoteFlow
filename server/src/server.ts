import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { registerSocketHandlers } from './sockets/noteSocket';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
  });
  registerSocketHandlers(io);

  server.listen(config.port, () => {
    console.log(`[server] NoteFlow API listening on port ${config.port} (${config.nodeEnv})`);
    console.log(`[server] CORS origin: ${config.clientUrl}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force-exit if cleanup hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[server] Fatal startup error:', error);
  process.exit(1);
});
