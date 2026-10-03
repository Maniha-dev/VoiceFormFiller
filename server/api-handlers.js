const MAX_GEMINI_BYTES = 1024 * 1024;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMITS = { gemini: 90, groq: 20 };
const requestsByClient = new Map();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function checkOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isRateLimited(req, service) {
  const forwarded = req.headers['x-forwarded-for'];
  const address = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
  const key = `${service}:${address}`;
  const now = Date.now();
  let bucket = requestsByClient.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    bucket = { startedAt: now, count: 0 };
    requestsByClient.set(key, bucket);
  }
  bucket.count += 1;
  if (requestsByClient.size > 10_000) {
    for (const [entry, value] of requestsByClient) {
      if (now - value.startedAt >= RATE_WINDOW_MS) requestsByClient.delete(entry);
    }
  }
  return bucket.count > RATE_LIMITS[service];
}

async function readBody(req, maxBytes) {
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > maxBytes) throw new ApiError(413, 'Request body is too large.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new ApiError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

function upstreamError(status) {
  if (status === 401 || status === 403) {
    return { status: 503, message: 'The provider credentials configured on the server are invalid.' };
  }
  if (status === 429) return { status: 429, message: 'The provider is busy. Please wait and try again.' };
  return { status: 502, message: `The provider request failed (${status}).` };
}

function safeFailure(res, error) {
  if (res.headersSent) return res.destroy();
  if (error instanceof ApiError) return sendJson(res, error.status, { error: error.message });
  return sendJson(res, 500, { error: 'The API request could not be completed.' });
}

export async function handleGemini(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    if (!checkOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    if (isRateLimited(req, 'gemini')) {
      res.setHeader('Retry-After', '60');
      return sendJson(res, 429, { error: 'Too many requests. Please wait and try again.' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return sendJson(res, 503, { error: 'Gemini is not configured on the server.' });
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return sendJson(res, 415, { error: 'Expected a JSON request.' });
    }

    let input;
    try {
      input = JSON.parse((await readBody(req, MAX_GEMINI_BYTES)).toString('utf8'));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return sendJson(res, 400, { error: 'Invalid JSON request.' });
    }
    if (typeof input?.system !== 'string' || !Array.isArray(input.parts) || input.parts.length > 50) {
      return sendJson(res, 400, { error: 'Invalid Gemini request.' });
    }
    const parts = input.parts.map((part) => {
      if (part && typeof part.text === 'string') return { text: part.text };
      if (part?.inlineData && typeof part.inlineData.mimeType === 'string' && typeof part.inlineData.data === 'string') {
        return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
      }
      return null;
    });
    if (parts.some((part) => part === null)) return sendJson(res, 400, { error: 'Invalid Gemini request.' });

    let response;
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      return sendJson(res, 502, { error: 'Could not reach the Gemini service.' });
    }
    if (!response.ok) {
      const failure = upstreamError(response.status);
      return sendJson(res, failure.status, { error: failure.message });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(await response.text());
  } catch (error) {
    return safeFailure(res, error);
  }
}

export async function handleGroq(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    if (!checkOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    if (isRateLimited(req, 'groq')) {
      res.setHeader('Retry-After', '60');
      return sendJson(res, 429, { error: 'Too many requests. Please wait and try again.' });
    }
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return sendJson(res, 503, { error: 'Groq is not configured on the server.' });
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
      return sendJson(res, 415, { error: 'Expected multipart audio data.' });
    }

    let form;
    try {
      const body = await readBody(req, MAX_AUDIO_BYTES);
      form = await new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      }).formData();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return sendJson(res, 400, { error: 'Invalid audio upload.' });
    }
    const file = form.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function' || file.size === 0) {
      return sendJson(res, 400, { error: 'An audio file is required.' });
    }
    const upload = new FormData();
    upload.append('file', file, file.name || 'audio.webm');
    upload.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
    upload.append('response_format', 'json');
    const language = form.get('language');
    if (['ur', 'pa', 'ps', 'en'].includes(language)) upload.append('language', language);

    let response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upload,
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      return sendJson(res, 502, { error: 'Could not reach the Groq service.' });
    }
    if (!response.ok) {
      const failure = upstreamError(response.status);
      return sendJson(res, failure.status, { error: failure.message });
    }
    let result;
    try {
      result = await response.json();
    } catch {
      return sendJson(res, 502, { error: 'Groq returned an invalid response.' });
    }
    return sendJson(res, 200, { text: typeof result.text === 'string' ? result.text : '' });
  } catch (error) {
    return safeFailure(res, error);
  }
}

export function createApiMiddleware() {
  return (req, res, next) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname === '/api/gemini') return handleGemini(req, res);
    if (pathname === '/api/groq/transcriptions') return handleGroq(req, res);
    return next();
  };
}
