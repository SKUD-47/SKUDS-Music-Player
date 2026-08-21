import { useEffect, useState } from "react";

const bands = [
  { freq: 60, label: "60" },
  { freq: 120, label: "120" },
  { freq: 250, label: "250" },
  { freq: 500, label: "500" },
  { freq: 1000, label: "1K" },
  { freq: 2000, label: "2K" },
  { freq: 4000, label: "4K" },
  { freq: 8000, label: "8K" },
  { freq: 12000, label: "12K" },
  { freq: 16000, label: "16K" },
];

const presets: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [8, 7, 5, 3, 1, 0, -1, -2, -2, -2],
  treble: [-2, -2, -1, 0, 1, 2, 4, 6, 7, 8],
  vocal: [-2, -1, 0, 2, 4, 4, 2, 1, 0, -1],
  rock: [5, 4, 2, -1, -2, 1, 3, 4, 4, 3],
  electronic: [5, 4, 2, 0, -2, 1, 3, 4, 5, 5],
};

type EqualizerProps = {
  songId?: string;
  onBandChange?: (index: number, value: number) => void;
};

type SavedEQ = {
  values: number[];
  enabled: boolean;
  preset: string;
};

const STORAGE_KEY = "skuds-equalizer-settings";

function getSavedSettings(songId?: string): SavedEQ | null {
  if (!songId) return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return null;

    const allSettings = JSON.parse(saved);

    return allSettings[songId] ?? null;
  } catch {
    return null;
  }
}

function saveSettings(songId: string, settings: SavedEQ) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const allSettings = saved ? JSON.parse(saved) : {};

    allSettings[songId] = settings;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(allSettings)
    );
  } catch {
    // Ignore storage errors
  }
}

export default function Equalizer({
  songId,
  onBandChange,
}: EqualizerProps) {
  const [enabled, setEnabled] = useState(true);
  const [values, setValues] = useState<number[]>([
    ...presets.flat,
  ]);
  const [preset, setPreset] = useState("flat");

  /*
   * Load the EQ settings whenever the song changes.
   */
  useEffect(() => {
    const saved = getSavedSettings(songId);

    if (saved) {
      setValues(saved.values);
      setEnabled(saved.enabled);
      setPreset(saved.preset);

      saved.values.forEach((value, index) => {
        onBandChange?.(
          index,
          saved.enabled ? value : 0
        );
      });

      return;
    }

    // No saved settings = start flat
    setValues([...presets.flat]);
    setEnabled(true);
    setPreset("flat");

    presets.flat.forEach((value, index) => {
      onBandChange?.(index, value);
    });
  }, [songId]);

  function saveCurrent(
    nextValues: number[],
    nextEnabled: boolean,
    nextPreset: string
  ) {
    if (!songId) return;

    saveSettings(songId, {
      values: nextValues,
      enabled: nextEnabled,
      preset: nextPreset,
    });
  }

  function updateBand(index: number, value: number) {
    const nextValues = [...values];
    nextValues[index] = value;

    setPreset("custom");
    setValues(nextValues);

    saveCurrent(
      nextValues,
      enabled,
      "custom"
    );

    onBandChange?.(
      index,
      enabled ? value : 0
    );
  }

  function changePreset(name: string) {
    const next = presets[name];

    if (!next) return;

    const nextValues = [...next];

    setPreset(name);
    setValues(nextValues);

    saveCurrent(
      nextValues,
      enabled,
      name
    );

    nextValues.forEach((value, index) => {
      onBandChange?.(
        index,
        enabled ? value : 0
      );
    });
  }

  function reset() {
    const nextValues = [...presets.flat];

    setPreset("flat");
    setValues(nextValues);

    saveCurrent(
      nextValues,
      enabled,
      "flat"
    );

    nextValues.forEach((value, index) => {
      onBandChange?.(
        index,
        enabled ? value : 0
      );
    });
  }

  function toggleEnabled() {
    const nextEnabled = !enabled;

    setEnabled(nextEnabled);

    saveCurrent(
      values,
      nextEnabled,
      preset
    );

    values.forEach((value, index) => {
      onBandChange?.(
        index,
        nextEnabled ? value : 0
      );
    });
  }

  return (
    <div className="eq-panel">
      <div className="eq-header">
        <div>
          <div className="eq-title">Equalizer</div>
          <div className="eq-subtitle">
            10 BAND
          </div>
        </div>

        <button
          type="button"
          aria-label={
            enabled
              ? "Disable equalizer"
              : "Enable equalizer"
          }
          className={`eq-switch ${
            enabled ? "active" : ""
          }`}
          onClick={toggleEnabled}
        >
          <span />
        </button>
      </div>

      <div className="eq-body">
        <div className="db-scale">
          <span>+12</span>
          <span>+6</span>
          <span>0</span>
          <span>-6</span>
          <span>-12</span>
        </div>

        <div className="eq-bands">
          {bands.map((band, index) => (
            <div
              className="eq-band"
              key={band.freq}
            >
              <div className="slider-area">
                <div className="eq-line" />

                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={values[index]}
                  disabled={!enabled}
                  aria-label={`${band.freq} Hz`}
                  onChange={(event) =>
                    updateBand(
                      index,
                      Number(event.target.value)
                    )
                  }
                  className="eq-slider"
                />

                <div className="eq-value">
                  {values[index] > 0 ? "+" : ""}
                  {values[index]} dB
                </div>
              </div>

              <div className="eq-frequency">
                {band.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="eq-footer">
        <select
          value={preset}
          onChange={(event) =>
            changePreset(event.target.value)
          }
          aria-label="Equalizer preset"
        >
          <option value="flat">Flat</option>
          <option value="bass">Bass Boost</option>
          <option value="treble">
            Treble Boost
          </option>
          <option value="vocal">Vocal</option>
          <option value="rock">Rock</option>
          <option value="electronic">
            Electronic
          </option>
        </select>

        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}
