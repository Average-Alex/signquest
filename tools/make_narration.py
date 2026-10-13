"""Record the narrator for the cinematics (js/cutscene.js).

    python tools/make_narration.py            # record anything new or changed
    python tools/make_narration.py --all      # re-record everything

Reads every caption from js/cutscene.js, records it with a Microsoft neural
voice (needs `pip install edge-tts` and the internet, only while recording),
and saves an MP3 per shot in assets/narration/, plus narration.json listing
which caption each file says. The game only plays a file when its caption
still matches, so edit a caption and re-run this to update its voice.

The game itself never sends anything anywhere: it just plays these files.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path

import edge_tts

try:
    # Trust the computer's own certificates too (school and office networks
    # often check secure connections with their own certificate).
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "js" / "cutscene.js"
OUT = ROOT / "assets" / "narration"
MANIFEST = OUT / "narration.json"

# A warm, natural storyteller. The "Multilingual" voices are the most
# human-sounding. Leave rate and pitch close to normal: changing them much
# makes any voice sound robotic.
VOICE = "en-US-AndrewMultilingualNeural"
RATE = "-4%"
PITCH = "-2Hz"


def captions() -> dict[str, str]:
    """{"opening-0": "Long ago...", "zone-meadow-0": "The Meadow...", ...}"""
    js = SOURCE.read_text(encoding="utf-8")
    out = {}
    opening = js[js.index("const OPENING = ["):js.index("// ---------- Each zone ----------")]
    for i, text in enumerate(re.findall(r'^\s+text: "([^"]+)",', opening, re.M)):
        out[f"opening-{i}"] = text
    zones = js[js.index("const ZONE_TEXT = {"):js.index("function zoneScene")]
    for zone, body in re.findall(r"^  (\w+): \[\n((?:\s+\"[^\"]*\",\n)+)\s+\],", zones, re.M):
        for i, text in enumerate(re.findall(r'"([^"]*)"', body)):
            out[f"zone-{zone}-{i}"] = text
    return out


async def record(key: str, text: str) -> None:
    await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(str(OUT / f"{key}.mp3"))


async def main(redo_all: bool) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    done = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    wanted = captions()
    for key, text in wanted.items():
        if not redo_all and done.get(key) == text and (OUT / f"{key}.mp3").exists():
            continue
        print(f"recording {key}: {text}")
        await record(key, text)
        done[key] = text
    # Forget files for captions that no longer exist.
    for key in [k for k in done if k not in wanted]:
        (OUT / f"{key}.mp3").unlink(missing_ok=True)
        del done[key]
    MANIFEST.write_text(json.dumps(done, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(done)} lines in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="re-record every line")
    asyncio.run(main(parser.parse_args().all))
