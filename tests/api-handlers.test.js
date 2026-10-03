import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { handleGemini, handleGroq } from '../server/api-handlers.js';

function createRequest(body, headers) {
  const req = Readable.from([body]);
  req.method = 'POST';
  req.headers = headers;
  req.socket = { remoteAddress: '127.0.0.1' };
  return req;
}

function createResponse() {
  return {
    headers: {},
    headersSent: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body = '') {
      this.body = String(body);
      this.headersSent = true;
    },
    destroy() {
      throw new Error('Unexpected response destroy.');
    },
  };
}

test('Gemini proxy uses server credentials and forwards only the provider response', async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'dummy-gemini-server-key';
  process.env.GEMINI_MODEL = 'test-gemini-model';
  t.after(() => {
    process.env.GEMINI_API_KEY = previousKey;
    process.env.GEMINI_MODEL = previousModel;
    globalThis.fetch = previousFetch;
  });

  let providerCalled = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/test-gemini-model:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'dummy-gemini-server-key');
    assert.equal(JSON.stringify(options.body).includes('dummy-gemini-server-key'), false);
    providerCalled = true;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"question":"Test?"}' }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const body = Buffer.from(JSON.stringify({ system: 'system', parts: [{ text: 'prompt' }] }));
  const req = createRequest(body, {
    'content-type': 'application/json',
    'content-length': String(body.length),
    'x-forwarded-for': '192.0.2.10',
  });
  const res = createResponse();
  await handleGemini(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(providerCalled, true);
  assert.equal(res.body.includes('dummy-gemini-server-key'), false);
  assert.equal(JSON.parse(res.body).candidates[0].content.parts[0].text, '{"question":"Test?"}');
});

test('Groq transcription proxy uses server credentials and model', async (t) => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousModel = process.env.GROQ_STT_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = 'dummy-groq-server-key';
  process.env.GROQ_STT_MODEL = 'test-whisper-model';
  t.after(() => {
    process.env.GROQ_API_KEY = previousKey;
    process.env.GROQ_STT_MODEL = previousModel;
    globalThis.fetch = previousFetch;
  });

  const form = new FormData();
  form.append('file', new Blob(['audio sample'], { type: 'audio/webm' }), 'sample.webm');
  form.append('language', 'ur');
  const upload = new Request('http://localhost', { method: 'POST', body: form });
  const body = Buffer.from(await upload.arrayBuffer());
  let providerCalled = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal(options.headers.Authorization, 'Bearer dummy-groq-server-key');
    assert.equal(options.body.get('model'), 'test-whisper-model');
    assert.equal(options.body.get('language'), 'ur');
    providerCalled = true;
    return new Response(JSON.stringify({ text: 'recognized words' }), { status: 200 });
  };

  const req = createRequest(body, {
    'content-type': upload.headers.get('content-type'),
    'content-length': String(body.length),
    'x-forwarded-for': '192.0.2.11',
  });
  const res = createResponse();
  await handleGroq(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(providerCalled, true);
  assert.equal(res.body.includes('dummy-groq-server-key'), false);
  assert.deepEqual(JSON.parse(res.body), { text: 'recognized words' });
});

test('Gemini proxy reports missing server configuration without exposing credentials', async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  t.after(() => {
    process.env.GEMINI_API_KEY = previousKey;
  });

  const body = Buffer.from(JSON.stringify({ system: 'system', parts: [{ text: 'prompt' }] }));
  const req = createRequest(body, {
    'content-type': 'application/json',
    'content-length': String(body.length),
    'x-forwarded-for': '192.0.2.12',
  });
  const res = createResponse();
  await handleGemini(req, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body), { error: 'Gemini is not configured on the server.' });
});
