/**
 * Local ElevenLabs proxy for hearing Ken's REAL voice in the demo —
 * no Django app needed.
 *
 * Setup (one time):
 *   1. Get an API key: elevenlabs.io → log in → click your avatar
 *      (bottom-left) → "API Keys" → "Create API Key" → copy it.
 *   2. Create a file named `.env` in the repo root containing:
 *         ELEVENLABS_API_KEY=your_key_here
 *      (.env is git-ignored — the key never gets committed.)
 *
 * Run:    npm run real-tts        (listens on http://localhost:8788)
 * Then put http://localhost:8788/tts in the demo's "TTS endpoint" box.
 *
 * Same contract as the Django proxy in /server-examples: POST { text } in,
 * mp3 out. The API key lives in this process only — never in the browser.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8788;
const MODEL = 'eleven_flash_v2_5';
const DEFAULT_VOICE_ID = 'Z9CSFTsEQ3J3DsnfCkiX'; // Ken's cloned voice

/** Minimal .env reader (KEY=value lines, # comments) — no dependency needed. */
function loadDotEnv() {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    for (const line of readFileSync(join(repoRoot, '.env'), 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !line.trim().startsWith('#') && !(match[1] in process.env)) {
        process.env[match[1]] = match[2];
      }
    }
  } catch {
    // no .env file — env vars may still be set in the shell
  }
}

loadDotEnv();
const apiKey = process.env.ELEVENLABS_API_KEY ?? '';
const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

if (!apiKey) {
  console.error(
    'No ELEVENLABS_API_KEY found.\n' +
      'Create a .env file in the repo root with:\n\n' +
      '    ELEVENLABS_API_KEY=your_key_here\n\n' +
      '(Get a key at elevenlabs.io → avatar menu → API Keys.)',
  );
  process.exit(1);
}

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    let text = '';
    try {
      text = String(JSON.parse(body).text ?? '').trim();
    } catch {
      // fall through with empty text
    }
    if (!text || text.length > 600) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"detail":"POST {\\"text\\": \\"one sentence\\"}"}');
      return;
    }

    try {
      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({ text, model_id: MODEL }),
        },
      );
      if (!upstream.ok) {
        console.error(`ElevenLabs error ${upstream.status}: ${(await upstream.text()).slice(0, 200)}`);
        res.writeHead(502).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      // Forward the mp3 bytes as they stream in.
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
      res.end();
      console.log(`spoke (${voiceId}): "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);
    } catch (err) {
      console.error('ElevenLabs request failed:', err.message);
      res.writeHead(502).end();
    }
  });
}).listen(PORT, () => {
  console.log(`Real ElevenLabs TTS on http://localhost:${PORT}/tts (voice ${voiceId}, model ${MODEL})`);
});
