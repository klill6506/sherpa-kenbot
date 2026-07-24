/**
 * Voice choice — which set of vocal cords he borrows.
 *
 * The package never knows anything about ElevenLabs: it just sends the chosen
 * voice's id along with each sentence (`POST {text, voice}`) and the host's
 * proxy decides what that id means. The host supplies the menu via the
 * `voices` prop, because only the host's server knows which voices it is
 * willing to pay for — see the allowlist note in server-examples.
 */

export interface KenBotVoice {
  /** Sent to the TTS endpoint as `voice`. Opaque to this package. */
  id: string;
  /** What the user sees in the picker, e.g. "Ken" or "British narrator". */
  label: string;
}

/**
 * Decide which voice to start with, in priority order:
 *
 *   1. the user's saved pick, if that voice is still on offer
 *   2. the `voice` prop (the host's default), if it's on offer — or if the
 *      host gave no menu at all, in which case we trust it blindly
 *   3. the first voice in the menu
 *   4. undefined — no voice id is sent and the server uses its own default
 *
 * A saved pick that has since disappeared from the menu is ignored rather
 * than sent anyway: a host app can change its voice list at any time, and a
 * stale id would just make every sentence fail.
 */
export function pickInitialVoice(
  voices: KenBotVoice[],
  stored: string | null,
  preferred: string | undefined,
): string | undefined {
  const offered = (id: string): boolean => voices.some((voice) => voice.id === id);

  if (stored && offered(stored)) return stored;
  if (preferred && (offered(preferred) || voices.length === 0)) return preferred;
  return voices[0]?.id;
}
