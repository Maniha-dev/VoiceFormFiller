import { createApiMiddleware } from './api-handlers.js';
import { loadEnv } from 'vite';

const SERVER_ENV_NAMES = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'GEMINI_MODEL', 'GROQ_STT_MODEL', 'GEMINI_TTS_MODEL', 'GEMINI_TTS_VOICE'];

export function installLocalApi(server) {
  const env = loadEnv(server.config.mode, server.config.root, '');
  for (const name of SERVER_ENV_NAMES) {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  }
  server.middlewares.use(createApiMiddleware());
}
