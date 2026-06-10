import { useRef, useState } from 'react';
import {
  Character,
  KENBOT_STATES,
  KenBot,
  defaultAppearance,
  type CharacterAppearance,
  type CharacterPose,
  type HairStyle,
  type KenBotHandle,
  type KenBotState,
} from 'sherpa-kenbot';

/**
 * KenBot Playground — the development workbench.
 *
 * Left: a big preview of the raw Character with every appearance + pose
 * control exposed, for iterating on his look.
 * Bottom-right corner: the real <KenBot /> at true size, living his idle
 * life (breathing, blinking, glancing) exactly as he would in a host app.
 * Both share the same appearance state, so a color tweak updates both.
 */

const HAIR_STYLES: HairStyle[] = ['short', 'buzz', 'side-part'];

const COLOR_FIELDS: { key: keyof CharacterAppearance; label: string }[] = [
  { key: 'skinColor', label: 'Skin' },
  { key: 'hairColor', label: 'Hair' },
  { key: 'eyeColor', label: 'Eyes' },
  { key: 'shirtColor', label: 'Shirt' },
  { key: 'tieColor', label: 'Tie' },
  { key: 'pantsColor', label: 'Pants' },
  { key: 'shoeColor', label: 'Shoes' },
];

const defaultPose: CharacterPose = {
  mouthOpen: 0,
  eyesOpen: 1,
  browLift: 0,
  pupilOffset: { x: 0, y: 0 },
};

export function App(): React.JSX.Element {
  const [appearance, setAppearance] = useState<CharacterAppearance>(defaultAppearance);
  const [pose, setPose] = useState<CharacterPose>(defaultPose);
  const [sizeScale, setSizeScale] = useState(1);

  // State machine demo: buttons drive BOTH the big preview (statically, so a
  // pose can be studied) and the corner KenBot via its imperative ref (the
  // real machine — timed states fall back to idle on their own there).
  const [previewState, setPreviewState] = useState<KenBotState>('idle');
  const [cornerState, setCornerState] = useState<KenBotState>('idle');
  const botRef = useRef<KenBotHandle>(null);

  const triggerState = (s: KenBotState): void => {
    setPreviewState(s);
    botRef.current?.setState(s);
  };

  const setColor = (key: keyof CharacterAppearance, value: string): void => {
    setAppearance((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="playground">
      <header className="playground__header">
        <h1>KenBot Playground</h1>
        <p>Phase 1 — tune his look here. The real-size KenBot idles in the corner.</p>
      </header>

      <main className="playground__main">
        <section className="stage">
          <Character className="stage__character" appearance={appearance} pose={pose} state={previewState} />
        </section>

        <aside className="panel">
          <h2>
            Animation state <span className="panel__badge">corner: {cornerState}</span>
          </h2>
          <div className="panel__states">
            {KENBOT_STATES.map((s) => (
              <button
                key={s}
                type="button"
                className={`panel__state-btn${previewState === s ? ' panel__state-btn--active' : ''}`}
                onClick={() => triggerState(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="panel__hint">
            Buttons pose the big preview and trigger the corner KenBot. In the corner, greet / celebrate /
            point return to idle by themselves — that's the state machine working.
          </p>

          <h2>Appearance</h2>
          <div className="panel__grid">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="panel__field">
                <span>{label}</span>
                <input
                  type="color"
                  value={String(appearance[key])}
                  onChange={(e) => setColor(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <label className="panel__field">
            <span>Hair style</span>
            <select
              value={appearance.hairStyle}
              onChange={(e) => setAppearance((prev) => ({ ...prev, hairStyle: e.target.value as HairStyle }))}
            >
              {HAIR_STYLES.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>

          <label className="panel__field panel__field--row">
            <input
              type="checkbox"
              checked={appearance.glasses}
              onChange={(e) => setAppearance((prev) => ({ ...prev, glasses: e.target.checked }))}
            />
            <span>Glasses</span>
          </label>

          <label className="panel__field panel__field--row">
            <input
              type="checkbox"
              checked={appearance.pocketProtector}
              onChange={(e) => setAppearance((prev) => ({ ...prev, pocketProtector: e.target.checked }))}
            />
            <span>Pocket protector</span>
          </label>

          <h2>Pose (preview only)</h2>
          <label className="panel__field">
            <span>Mouth open: {pose.mouthOpen.toFixed(2)}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={pose.mouthOpen}
              onChange={(e) => setPose((prev) => ({ ...prev, mouthOpen: Number(e.target.value) }))}
            />
          </label>
          <label className="panel__field">
            <span>Brow lift: {pose.browLift.toFixed(2)}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={pose.browLift}
              onChange={(e) => setPose((prev) => ({ ...prev, browLift: Number(e.target.value) }))}
            />
          </label>
          <label className="panel__field">
            <span>Eyes open: {pose.eyesOpen.toFixed(2)}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={pose.eyesOpen}
              onChange={(e) => setPose((prev) => ({ ...prev, eyesOpen: Number(e.target.value) }))}
            />
          </label>
          <label className="panel__field">
            <span>Look left/right: {pose.pupilOffset.x.toFixed(2)}</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={pose.pupilOffset.x}
              onChange={(e) =>
                setPose((prev) => ({ ...prev, pupilOffset: { ...prev.pupilOffset, x: Number(e.target.value) } }))
              }
            />
          </label>
          <label className="panel__field">
            <span>Look up/down: {pose.pupilOffset.y.toFixed(2)}</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={pose.pupilOffset.y}
              onChange={(e) =>
                setPose((prev) => ({ ...prev, pupilOffset: { ...prev.pupilOffset, y: Number(e.target.value) } }))
              }
            />
          </label>

          <h2>Corner KenBot</h2>
          <label className="panel__field">
            <span>Size scale: {sizeScale.toFixed(2)}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={sizeScale}
              onChange={(e) => setSizeScale(Number(e.target.value))}
            />
          </label>

          <button
            type="button"
            className="panel__reset"
            onClick={() => {
              setAppearance(defaultAppearance);
              setPose(defaultPose);
              setSizeScale(1);
            }}
          >
            Reset to defaults
          </button>
        </aside>
      </main>

      {/* The real thing, exactly as a host app would mount it */}
      <KenBot ref={botRef} appearance={appearance} sizeScale={sizeScale} onStateChange={setCornerState} />
    </div>
  );
}
