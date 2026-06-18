import mongoose from 'mongoose';
import { config } from './env';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('[db] MongoDB connected');
  } catch (error) {
    console.error('[db] MongoDB connection error:', error);
    throw error;
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB runtime error:', err);
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  console.log('[db] MongoDB connection closed');
}
