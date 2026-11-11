# Traces the owner supplied Mary's Logistics Group logo (transparent PNG) into vector layers.
# Requires: pip install potracer numpy pillow
# Usage: python3 scripts/brand/trace_logo.py && python3 scripts/brand/generate_logo_files.py
import json, pathlib
import numpy as np
import potrace
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
APP = HERE.parent.parent
src = np.array(Image.open(APP / "brand-source/marys-logistics-group-logo-supplied.png").convert("RGBA")).astype(int)
r, g, b, a = src[..., 0], src[..., 1], src[..., 2], src[..., 3]
op = a >= 128
white = op & (r > 190) & (g > 190) & (b > 190)
red = op & ~white & (r > 110) & ((r - g) > 70)
navy = op & ~white & ~red

# Horizontal bands separated by empty rows: symbol, MARY'S, LOGISTICS GROUP with rules.
rows = op.any(axis=1)
bands, start = [], None
for y, filled in enumerate(rows):
    if filled and start is None: start = y
    if not filled and start is not None: bands.append((start, y)); start = None
if start is not None: bands.append((start, len(rows)))
bands = [bd for bd in bands if bd[1] - bd[0] > 20]
assert len(bands) == 3, bands
def band(i):
    m = np.zeros_like(op); m[bands[i][0]:bands[i][1]] = True; return m

def f(v): return f"{v:.1f}".rstrip("0").rstrip(".")
def trace(mask, turd=40):
    d = []
    for c in potrace.Bitmap(~mask).trace(turdsize=turd, alphamax=1.0, opticurve=True, opttolerance=0.2):
        s = c.start_point; d.append(f"M{f(s.x)} {f(s.y)}")
        for seg in c.segments:
            if seg.is_corner: d.append(f"L{f(seg.c.x)} {f(seg.c.y)}L{f(seg.end_point.x)} {f(seg.end_point.y)}")
            else: d.append(f"C{f(seg.c1.x)} {f(seg.c1.y)} {f(seg.c2.x)} {f(seg.c2.y)} {f(seg.end_point.x)} {f(seg.end_point.y)}")
        d.append("Z")
    return "".join(d)
def bbox(mask):
    ys, xs = np.where(mask); return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]

layers = {
    "markNavy": navy & band(0), "markRed": red & band(0), "markWhite": white & band(0),
    "wordmark": navy & band(1), "subline": navy & band(2), "rules": red & band(2),
}
out = {k: trace(m, 80 if k in ("markRed", "markNavy", "rules") else 30) for k, m in layers.items()}
out["boxes"] = {"mark": bbox(op & band(0)), "wordmark": bbox(op & band(1)), "subline": bbox(navy & band(2)), "lower": bbox(op & band(2)), "all": bbox(op)}
json.dump(out, open(HERE / "logo-paths.json", "w"))
print({k: len(v) for k, v in out.items() if k != "boxes"}, out["boxes"])
