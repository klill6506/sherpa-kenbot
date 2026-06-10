import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The voice: fetches synthesized audio for one sentence at a time from the
 * host's ttsEndpoint, plays the clips back-to-back through the Web Audio API,
 * and measures live loudness to drive the mouth.
 *
 * How the pieces fit:
 *
 *   speak("First sentence.")  ──► fetch + decode (starts immediately)
 *   speak("Second sentence.") ──► fetch + decode (in parallel!)
 *                                      │
 *                            play loop takes buffers IN ORDER
 *                                      │
 *                  AudioBufferSource ► AnalyserNode ► speakers
 *                                      │
 *               requestAnimationFrame reads the analyser's waveform,
 *               converts it to loudness (RMS), maps that to mouthOpen
 *
 * The queue is why speech starts fast: sentence 1 plays while sentences 2..n
 * are still being synthesized by ElevenLabs.
 *
 * Graceful degradation (hard requirement): no ttsEndpoint, muted, a failed
 * request, or a blocked AudioContext all mean "just don't speak" — the text
 * captions are always shown anyway, and the user never sees an error.
 */

export interface SpeechController {
  /** Queue one sentence for synthesis + playback. No-op when muted/disabled. */
  speak: (sentence: string) => void;
  /** Cut speech now: stop the current clip and abandon the queue. */
  stop: () => void;
  /**
   * Browsers only allow audio after a user gesture ("autoplay policy").
   * Call this from a real click/submit handler to create + resume the
   * AudioContext while we're allowed to.
   */
  unlock: () => void;
  /** True from the first queued sentence until the last clip ends. */
  speaking: boolean;
  /** Live mouth openness 0..1 measured from the playing audio. */
  mouthOpen: number;
}

/** Loudness below this is treated as silence (breath, room noise). */
const NOISE_GATE = 0.02;
/** Multiplier mapping RMS loudness (speech peaks ~0.1–0.3) onto 0..1. */
const MOUTH_GAIN = 7;
/** After this many failed TTS requests in a row, give up quietly. */
const MAX_CONSECUTIVE_FAILURES = 2;

export function useSpeech(args: { ttsEndpoint?: string; muted: boolean }): SpeechController {
  const { ttsEndpoint, muted } = args;

  const [speaking, setSpeaking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Decoded-audio promises, in speaking order. Fetches run in parallel; the
  // play loop awaits them one at a time. null = that sentence failed.
  const queueRef = useRef<Promise<AudioBuffer | null>[]>([]);
  const playLoopRunning = useRef(false);
  const currentSource = useRef<AudioBufferSourceNode | null>(null);
  const consecutiveFailures = useRef(0);
  // Bumped by stop(); pending loops compare and bail so a stale loop can't
  // keep playing after the panel closed or mute flipped.
  const generation = useRef(0);

  /** Create (or resume) the AudioContext. Safe to call repeatedly. */
  const unlock = useCallback((): void => {
    if (typeof window === 'undefined') return;
    if (!ctxRef.current) {
      // Safari still ships AudioContext under the webkit prefix.
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return; // no Web Audio at all — text-only forever
      ctxRef.current = new Ctor();
      const analyser = ctxRef.current.createAnalyser();
      analyser.fftSize = 512; // small window = fast-reacting mouth
      analyser.connect(ctxRef.current.destination);
      analyserRef.current = analyser;
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume().catch(() => {
        // Still blocked — we'll try again on the next gesture.
      });
    }
  }, []);

  /** Synthesize one sentence. Resolves null on any failure (handled quietly). */
  const fetchClip = useCallback(
    async (sentence: string): Promise<AudioBuffer | null> => {
      const ctx = ctxRef.current;
      if (!ttsEndpoint || !ctx) return null;
      try {
        const response = await fetch(ttsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sentence }),
        });
        if (!response.ok) throw new Error(`tts ${response.status}`);
        const bytes = await response.arrayBuffer();
        const clip = await ctx.decodeAudioData(bytes);
        consecutiveFailures.current = 0;
        return clip;
      } catch {
        consecutiveFailures.current += 1;
        return null; // graceful: this sentence is silent, captions carry it
      }
    },
    [ttsEndpoint],
  );

  /** Reads loudness from the analyser every frame and moves the mouth. */
  const runMouthLoop = useCallback((myGeneration: number): void => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    let smoothed = 0;

    const tick = (): void => {
      if (myGeneration !== generation.current) return; // stopped
      analyser.getByteTimeDomainData(samples);
      // RMS: average loudness of the waveform window (128 = silence midline).
      let sumOfSquares = 0;
      for (const sample of samples) {
        const deviation = (sample - 128) / 128;
        sumOfSquares += deviation * deviation;
      }
      const rms = Math.sqrt(sumOfSquares / samples.length);
      const target = Math.min(1, Math.max(0, (rms - NOISE_GATE) * MOUTH_GAIN));
      // Fast attack, slower release — mouths snap open and ease closed.
      smoothed += (target - smoothed) * (target > smoothed ? 0.5 : 0.2);
      setMouthOpen(Math.round(smoothed * 50) / 50); // quantize to skip no-op renders
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  /** Plays queued clips in order until the queue runs dry. */
  const runPlayLoop = useCallback(async (): Promise<void> => {
    if (playLoopRunning.current) return;
    playLoopRunning.current = true;
    const myGeneration = generation.current;
    setSpeaking(true);
    runMouthLoop(myGeneration);

    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (next === undefined) break;
      const clip = await next;
      if (myGeneration !== generation.current) return; // stopped while fetching
      if (!clip) {
        if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
          queueRef.current = []; // backend is down — stop trying this answer
          break;
        }
        continue; // one bad sentence — skip it, keep going
      }
      const ctx = ctxRef.current;
      const analyser = analyserRef.current;
      if (!ctx || !analyser) break;
      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = clip;
        source.connect(analyser);
        source.onended = () => resolve();
        currentSource.current = source;
        source.start();
      });
      if (myGeneration !== generation.current) return;
    }

    playLoopRunning.current = false;
    setSpeaking(false);
    setMouthOpen(0);
  }, [runMouthLoop]);

  const speak = useCallback(
    (sentence: string): void => {
      const text = sentence.trim();
      if (!text || !ttsEndpoint || muted) return;
      unlock(); // may be a no-op; real unlocking happens in gesture handlers
      if (!ctxRef.current || ctxRef.current.state !== 'running') return; // blocked → text-only
      queueRef.current.push(fetchClip(text)); // fetch starts NOW, in parallel
      void runPlayLoop();
    },
    [ttsEndpoint, muted, unlock, fetchClip, runPlayLoop],
  );

  const stop = useCallback((): void => {
    generation.current += 1; // invalidates play + mouth loops
    queueRef.current = [];
    try {
      currentSource.current?.stop();
    } catch {
      // already stopped — fine
    }
    currentSource.current = null;
    playLoopRunning.current = false;
    consecutiveFailures.current = 0;
    setSpeaking(false);
    setMouthOpen(0);
  }, []);

  // Flipping mute mid-sentence cuts him off immediately.
  useEffect(() => {
    if (muted) stop();
  }, [muted, stop]);

  // Tidy up on unmount.
  useEffect(() => {
    return () => {
      stop();
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, [stop]);

  return { speak, stop, unlock, speaking, mouthOpen };
}
