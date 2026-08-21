import { useState } from "react";

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

export default function Equalizer() {
  const [enabled, setEnabled] = useState(true);

  const [values, setValues] = useState(
    bands.map(() => 0)
  );

  function updateBand(index: number, value: number) {
    setValues((current) => {
      const next = [...current];
      next[index] = value;

      // Later: send this value to your actual Web Audio filter.
      console.log(bands[index].freq, value);

      return next;
    });
  }

  function reset() {
    setValues(bands.map(() => 0));
  }

  return (
    <div className="eq-panel">
      <div className="eq-header">
        <div>
          <div className="eq-title">Equalizer</div>
          <div className="eq-subtitle">10 BAND</div>
        </div>

        <button
          className={`eq-switch ${enabled ? "active" : ""}`}
          onClick={() => setEnabled(!enabled)}
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
            <div className="eq-band" key={band.freq}>

              <div className="slider-area">
                <div className="eq-line" />

                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={values[index]}
                  disabled={!enabled}
                  onChange={(e) =>
                    updateBand(index, Number(e.target.value))
                  }
                  className="eq-slider"
                  style={{
                    "--value": `${values[index]}%`,
                  } as React.CSSProperties}
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
        <select defaultValue="flat">
          <option value="flat">Flat</option>
          <option value="bass">Bass Boost</option>
          <option value="treble">Treble Boost</option>
          <option value="vocal">Vocal</option>
          <option value="rock">Rock</option>
          <option value="electronic">Electronic</option>
        </select>

        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
