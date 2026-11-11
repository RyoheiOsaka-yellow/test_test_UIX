"""Generate narration audio (one WAV per scene) from narration.json with Kokoro (voice jf_alpha).

Setup (once):  python -m venv venv && venv/bin/pip install kokoro-onnx soundfile "misaki[ja]"
               venv/bin/python -m unidic download
               npx hyperframes tts "test" -v jf_alpha   # downloads the Kokoro model into ~/.cache/hyperframes/tts
Run:           venv/bin/python tools/tts.py            # writes assets/audio/NN.mp3 + assets/audio/durations.json
"""
import json, os, re, subprocess
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from misaki import ja

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.expanduser("~/.cache/hyperframes/tts")
VOICE, SPEED, GAP = "jf_alpha", 1.0, 0.4
g2p = ja.JAG2P()
k = Kokoro(f"{CACHE}/models/kokoro-v1.0.onnx", f"{CACHE}/voices/voices-v1.0.bin")
lines = json.load(open(f"{ROOT}/narration.json", encoding="utf-8"))
durs = []
for i, text in enumerate(lines):
    parts, sr = [], 24000
    for sent in [s for s in re.split(r"。", text) if s.strip()]:
        ph = ", ".join(g2p(c)[0].strip() for c in sent.split("、") if c.strip()) + "."
        print(f"{i:02d} {sent}\n   {ph}")
        a, sr = k.create(ph, voice=VOICE, speed=SPEED, is_phonemes=True)
        parts += [a, np.zeros(int(sr * GAP), dtype=a.dtype)]
    audio = np.concatenate(parts[:-1])
    wav = f"{ROOT}/assets/audio/{i:02d}.wav"
    sf.write(wav, audio, sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5", "-ar", "48000", "-b:a", "128k", wav[:-4] + ".mp3"], check=True)
    os.remove(wav)
    durs.append(round(len(audio) / sr, 2))
json.dump(durs, open(f"{ROOT}/assets/audio/durations.json", "w"))
print("total speech:", round(sum(durs), 1), "s")
