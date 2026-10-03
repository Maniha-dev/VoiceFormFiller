import { handleTts } from '../server/api-handlers.js';

export const config = { api: { bodyParser: false } };
export const maxDuration = 30;
export default handleTts;
