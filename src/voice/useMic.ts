import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The ear: push-to-talk speech input using the browser's built-in
 * SpeechRecognition engine (Chrome and Edge ship it; Firefox does not).
 *
 * How it flows:
 *
 *   click 🎤  ──► ask for mic permission (getUserMedia, first time only)
 *                                │
 *                        start recognition; you speak
 *                                │
 *                    "interim" words stream back and fill the chat
 *                    input so you can see that it's hearing you
 *                                │
 *                    you stop talking → the engine detects the pause,
 *                    finalizes the sentence and fires onend
 *                                │
 *                          onFinal(text) ──► the panel sends it
 *
 * WHY THE SEPARATE PERMISSION STEP: if you call recognition.start() before the
 * browser has microphone permission, Chrome puts up its permission prompt and
 * KILLS that recognition session while you're clicking "Allow". The user
 * speaks into a session that no longer exists and nothing happens. Asking via
 * getUserMedia first (and immediately closing the stream — we only wanted the
 * permission) means recognition only ever starts once the mic is really ours.
 *
 * NO KEYS, NO SERVER: this is the browser's own engine, so there's nothing to
 * proxy and nothing to pay for. The trade-off is that Chrome does the
 * recognition in Google's cloud — the audio of what you say leaves the
 * machine. Fine for "how do I add a client?", worth knowing before dictating
 * anything confidential.
 *
 * FAILURE IS NEVER SILENT HERE. useSpeech degrades quietly because a missing
 * voice still leaves readable text on screen — nothing looks broken. The mic
 * is the opposite: you clicked a button and spoke, so if nothing comes back
 * you need to be told why (no mic, muted mic, blocked permission, nothing
 * heard). Every dead end sets `notice` with a plain-English sentence.
 */

/* -------------------------------------------------------------------------
 * Minimal type declarations.
 *
 * TypeScript's DOM library still doesn't describe SpeechRecognition, and
 * `any` is banned in this package — so we declare exactly the slice of the
 * API we touch. ArrayLike<T> gives us both `.length` and numeric indexing.
 * ---------------------------------------------------------------------- */

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult extends ArrayLike<SpeechAlternative> {
  /** False while the engine is still guessing, true once it has committed. */
  isFinal: boolean;
}

interface SpeechResultEvent {
  /** Index of the first result that changed — everything before it is settled. */
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}

interface SpeechErrorEvent {
  /** 'no-speech' | 'aborted' | 'not-allowed' | 'audio-capture' | 'network' | … */
  error: string;
}

interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognizerConstructor = new () => SpeechRecognizer;

/** Chrome/Edge expose it prefixed; the standard name is there for the future. */
function getRecognizerConstructor(): SpeechRecognizerConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognizerConstructor;
    webkitSpeechRecognition?: SpeechRecognizerConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Hard stop after this long, so a hot mic can't stay open forever. */
const MAX_LISTEN_MS = 30_000;

const BLOCKED_NOTICE =
  'Microphone blocked. Click the camera/lock icon in the address bar, allow the microphone, then try again — or just type.';
const NO_MIC_NOTICE = "No microphone found. Check that one is plugged in and enabled in Windows sound settings.";
const NOT_HEARD_NOTICE = "I didn't hear anything. Check your mic isn't muted, then click 🎤 and speak.";
const NETWORK_NOTICE = "Speech recognition couldn't reach its service. Check the connection, or type instead.";
const INSECURE_NOTICE = 'Voice input needs an https:// address or localhost. Open the site at localhost to use the mic.';
const GENERIC_NOTICE = "The microphone didn't start. Try again, or type your question.";

/** Turn a getUserMedia rejection into something a human can act on. */
function describePermissionError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return BLOCKED_NOTICE;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return NO_MIC_NOTICE;
  return GENERIC_NOTICE;
}

/** Same for the recognition engine's own error codes. */
function describeRecognitionError(code: string): string | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return BLOCKED_NOTICE;
    case 'audio-capture':
      return NO_MIC_NOTICE;
    case 'no-speech':
      return NOT_HEARD_NOTICE;
    case 'network':
      return NETWORK_NOTICE;
    case 'aborted':
      return null; // we stopped it on purpose — nothing to report
    default:
      return GENERIC_NOTICE;
  }
}

export interface MicController {
  /** False = no mic button at all (unsupported browser, or turned off). */
  supported: boolean;
  /** True from the moment the mic is really open until the engine hands back text. */
  listening: boolean;
  /** Live text as it's recognized — shown in the input while you talk. */
  transcript: string;
  /** A plain-English explanation when nothing came back. Null = all fine. */
  notice: string | null;
  /** Begin listening (asks permission first, if needed). */
  start: () => void;
  /** Stop early and submit whatever was recognized so far. */
  stop: () => void;
  /** Stop and throw the transcript away. */
  cancel: () => void;
}

export function useMic(args: {
  /** Master switch — the `voiceInput` prop. */
  enabled: boolean;
  /** BCP-47 language tag for recognition. Default 'en-US'. */
  lang?: string;
  /** Called with the finished sentence when you stop talking. */
  onFinal: (text: string) => void;
}): MicController {
  const { enabled, lang = 'en-US', onFinal } = args;

  // Feature detection runs once — the answer can't change mid-session.
  const [constructor] = useState<SpeechRecognizerConstructor | null>(getRecognizerConstructor);
  const supported = enabled && constructor !== null;

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  // Committed text so far this turn. A ref, not state, because the result
  // handler needs the running total synchronously.
  const finalTextRef = useRef('');
  // Set by cancel(): tells the onend handler to drop the transcript.
  const discardRef = useRef(false);
  // True between the click and the mic actually opening (permission prompt).
  const startingRef = useRef(false);
  // Permission only has to be requested once per page load.
  const permissionRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest callback without re-creating start() on every render.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  /** Tear down the live recognizer and its watchdog. */
  const teardown = useCallback((): void => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    if (!recognizer) return;
    // Unhook first: abort() fires onend, and we've already handled this turn.
    recognizer.onresult = null;
    recognizer.onerror = null;
    recognizer.onend = null;
    try {
      recognizer.abort();
    } catch {
      // Already dead — nothing to do.
    }
  }, []);

  /** Open a recognition session. Permission is already settled by here. */
  const beginRecognition = useCallback((): void => {
    if (!constructor || recognizerRef.current) return;

    const recognizer = new constructor();
    recognizer.lang = lang;
    // continuous = false is what gives us push-to-talk: the engine watches for
    // the natural pause at the end of your sentence and ends the turn itself.
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;

    recognizer.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalTextRef.current += text;
        else interim += text;
      }
      setTranscript(`${finalTextRef.current} ${interim}`.trim());
    };

    recognizer.onerror = (event) => {
      const message = describeRecognitionError(event.error);
      if (message) setNotice(message);
      // A blocked mic means the permission we thought we had is gone —
      // ask again next time rather than starting a doomed session.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        permissionRef.current = false;
        discardRef.current = true;
      }
    };

    recognizer.onend = () => {
      const text = finalTextRef.current.trim();
      const discard = discardRef.current;
      teardown();
      setListening(false);
      setTranscript('');
      finalTextRef.current = '';
      discardRef.current = false;
      if (!discard && text) onFinalRef.current(text);
    };

    finalTextRef.current = '';
    discardRef.current = false;
    setTranscript('');
    try {
      recognizer.start();
    } catch {
      setNotice(GENERIC_NOTICE);
      return;
    }
    recognizerRef.current = recognizer;
    setListening(true);
    timeoutRef.current = setTimeout(() => {
      // Watchdog: stop() (not cancel) so a long answer still gets submitted.
      try {
        recognizerRef.current?.stop();
      } catch {
        // Already stopped.
      }
    }, MAX_LISTEN_MS);
  }, [constructor, lang, teardown]);

  const start = useCallback((): void => {
    if (!constructor || !enabled || recognizerRef.current || startingRef.current) return;
    setNotice(null);

    // Insecure origins (a http:// LAN address, say) have no mic at all — and
    // the failure there is famously confusing, so name it.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setNotice(INSECURE_NOTICE);
      return;
    }

    if (permissionRef.current) {
      beginRecognition();
      return;
    }

    startingRef.current = true;
    void (async () => {
      try {
        // Settle permission BEFORE recognition starts — see the note up top.
        const media = navigator.mediaDevices;
        if (media?.getUserMedia) {
          const stream = await media.getUserMedia({ audio: true });
          // We only wanted the grant; the recognizer opens its own stream.
          for (const track of stream.getTracks()) track.stop();
        }
        permissionRef.current = true;
        beginRecognition();
      } catch (error) {
        setNotice(describePermissionError(error));
      } finally {
        startingRef.current = false;
      }
    })();
  }, [constructor, enabled, beginRecognition]);

  /** Stop listening now; onend still fires, so the transcript is submitted. */
  const stop = useCallback((): void => {
    try {
      recognizerRef.current?.stop();
    } catch {
      // Not running.
    }
  }, []);

  const cancel = useCallback((): void => {
    if (!recognizerRef.current) return;
    discardRef.current = true;
    teardown();
    setListening(false);
    setTranscript('');
    finalTextRef.current = '';
    discardRef.current = false;
  }, [teardown]);

  // Never leave the mic open behind us.
  useEffect(() => teardown, [teardown]);

  return { supported, listening, transcript, notice, start, stop, cancel };
}
