/**
 * Offline fake voice for the demo — NO ElevenLabs, NO API key.
 *
 * Run:    npm run mock-tts        (listens on http://localhost:8787)
 * Then put http://localhost:8787/tts in the demo's "TTS endpoint" box.
 *
 * It accepts the same request the real proxy does (POST { text }) and
 * returns a WAV of robotic babble whose loudness rises and falls like
 * syllables — enough to exercise the whole voice pipeline: sentence queue,
 * Web Audio playback, and amplitude-driven lip sync.
 */
import { createServer } from 'node:http';

const PORT = 8787;
const SAMPLE_RATE = 22050;

/**
 * Three obviously-different fake voices, so the voice picker can be exercised
 * offline. Pitch and syllable rate are all it takes to tell them apart.
 */
const VOICES = [
  { id: 'robot', label: 'Robot', pitch: 130, syllablesPerSecond: 4 },
  { id: 'chipmunk', label: 'Chipmunk', pitch: 300, syllablesPerSecond: 6 },
  { id: 'giant', label: 'Giant', pitch: 72, syllablesPerSecond: 2.6 },
];

/** Builds a syllable-ish babble waveform for the given text length. */
function synthesizeBabble(text, voiceProfile) {
  const { pitch, syllablesPerSecond } = voiceProfile;
  const seconds = Math.min(6, Math.max(0.6, text.length * 0.055));
  const sampleCount = Math.floor(seconds * SAMPLE_RATE);
  const samples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    // Loudness pulses like someone talking — this is what the lip sync reads.
    const syllable = Math.max(0, Math.sin(2 * Math.PI * syllablesPerSecond * t)) ** 1.6;
    // A buzzy "voice" tone with a little wobble so it isn't a pure beep.
    const voice = Math.sin(2 * Math.PI * pitch * t + 3 * Math.sin(2 * Math.PI * 2.1 * t));
    // Fade the whole clip in/out to avoid clicks.
    const edge = Math.min(1, t / 0.05, (seconds - t) / 0.08);
    samples[i] = Math.round(voice * syllable * edge * 0.45 * 32767);
  }
  return samples;
}

/** Wraps raw 16-bit mono PCM in a minimal WAV header. */
function toWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  Buffer.from(samples.buffer).copy(buffer, 44);
  return buffer;
}

createServer((req, res) => {
  // CORS so the Vite demo (different port) can call us.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  // Same shape the real proxy serves: [{ id, label }] for the voice picker.
  if (req.method === 'GET' && req.url.startsWith('/voices')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(VOICES.map(({ id, label }) => ({ id, label }))));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let text = '';
    let requestedVoice = '';
    try {
      const payload = JSON.parse(body);
      text = String(payload.text ?? '');
      requestedVoice = String(payload.voice ?? '');
    } catch {
      // fall through with empty text
    }
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"detail":"POST {\\"text\\": \\"...\\"}"}');
      return;
    }
    // Unknown ids fall back to the default rather than erroring — the real
    // proxy does the same, since an unknown voice is not the user's fault.
    const voiceProfile = VOICES.find((v) => v.id === requestedVoice) ?? VOICES[0];
    const wav = toWav(synthesizeBabble(text, voiceProfile));
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length });
    res.end(wav);
    console.log(`spoke as ${voiceProfile.id}: "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`);
  });
}).listen(PORT, () => {
  console.log(`Mock TTS (robotic babble) on http://localhost:${PORT}/tts`);
  console.log(`Fake voices for the picker: ${VOICES.map((v) => v.id).join(', ')} (GET /voices)`);
});
