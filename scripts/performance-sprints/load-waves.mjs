import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cached;

export function loadWaves() {
  if (cached) return cached;
  const wavesPath = path.join(__dirname, "waves.json");
  const raw = JSON.parse(fs.readFileSync(wavesPath, "utf8"));
  cached = raw.waves;
  return cached;
}

export function getWaveSprints(waveNum) {
  const waves = loadWaves();
  const wave = waves[String(waveNum)];
  if (!wave) throw new Error(`Unknown wave: ${waveNum}`);
  return wave.sprints;
}

export function listWavesForHelp() {
  const waves = loadWaves();
  return Object.entries(waves)
    .map(([k, w]) => `  ${k}: ${w.sprints.join(", ")}  — ${w.name}`)
    .join("\n");
}
