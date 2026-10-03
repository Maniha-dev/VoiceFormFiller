import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
import {installLocalApi} from './server/vite-middleware.js';

export default defineConfig({plugins:[react(),{
 name:'local-server-api',
 configureServer:installLocalApi
}]});
