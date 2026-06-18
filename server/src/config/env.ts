import dotenv from 'dotenv';
import path from 'path';

// Load variables from server/.env (falls back to process env in production deploys)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  clientUrl: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: parseInt(process.env.PORT ?? '5000', 10),
  mongoUri: requireEnv('MONGO_URI', 'mongodb://127.0.0.1:27017/noteflow'),
  jwtSecret: requireEnv('JWT_SECRET', 'insecure_dev_secret_change_me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
};
