# Piper Samples

This directory is a reference and evaluation workspace for
[Piper](https://github.com/rhasspy/piper) text-to-speech assets.

It is not part of the default Rasa/FastAPI runtime. The root `.dockerignore`
excludes this directory from Docker build contexts so the production images stay
small.

## Directory Map

| Path | Purpose |
| --- | --- |
| `configs/` | Voice configuration JSON files. |
| `resources/` | Browser-side Piper/espeak runtime files used by the demos. |
| `samples/` | Generated voice samples grouped by language, locale, voice, and quality. |
| `test_sentences/` | Text and JSONL prompt sets used to generate or compare samples. |
| `voice/` | Local voice models, previews, and audio experiments. |
| `_script/` | Utility scripts for copying, exporting, and generating samples. |
| `index.html`, `demo.html`, `main.js` | Local browser demos for inspecting samples. |
| `voices.json` | Voice catalog used by the demo tooling. |

## Operational Notes

- Do not mount or copy this directory into production containers unless voice
  experiments are explicitly needed.
- Keep generated one-off audio outside the project root or under a clearly named
  temporary folder.
- Before committing new audio/model assets, check the size impact with:

```powershell
Get-ChildItem piper-samples -Recurse -File |
  Measure-Object Length -Sum
```

## Current Size Hotspots

The largest sections are:

- `samples/`: generated sample audio.
- `voice/`: local model and preview files.
- `espeakng.worker.data`: browser runtime data for the demo.
