# Traces the owner supplied logo PNG into vector layers (requires: pip install potracer numpy pillow).
# Usage: python3 scripts/brand/trace_logo.py && python3 scripts/brand/generate_logo_files.py
from PIL import Image
import potrace, numpy as np, json, pathlib
HERE=pathlib.Path(__file__).resolve().parent
APP=HERE.parent.parent
src=np.array(Image.open(APP/"brand-source/velez-freight-logo-supplied.png").convert("RGBA")).astype(int)
r,g,b,a=src[...,0],src[...,1],src[...,2],src[...,3]
op=a>=128
white=op&(r>190)&(g>190)&(b>190)
red=op&~white&(r>110)&((r-g)>70)
navy=op&~white&~red
H=src.shape[0]
# find split row: first row below the road symbol with no opaque pixels
rows=op.any(axis=1); split=None
for y in range(150,H):
  if not rows[y]: split=y; break
print("split",split)
top=np.zeros_like(op); top[:split]=True
def f(v): return f"{v:.1f}".rstrip("0").rstrip(".")
def trace(m):
  d=[]
  for c in potrace.Bitmap(~m).trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.2):
    s=c.start_point; d.append(f"M{f(s.x)} {f(s.y)}")
    for seg in c.segments:
      if seg.is_corner: d.append(f"L{f(seg.c.x)} {f(seg.c.y)}L{f(seg.end_point.x)} {f(seg.end_point.y)}")
      else: d.append(f"C{f(seg.c1.x)} {f(seg.c1.y)} {f(seg.c2.x)} {f(seg.c2.y)} {f(seg.end_point.x)} {f(seg.end_point.y)}")
    d.append("Z")
  return "".join(d)
def bbox(m):
  ys,xs=np.where(m); return int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1
out=dict(wings=trace(red&top), rules=trace(red&~top), road=trace(navy&top), lines=trace(white), lettering=trace(navy&~top))
print({k:len(v) for k,v in out.items()})
print("all",bbox(op),"mark",bbox(op&top))
json.dump(out,open(HERE/"logo-paths.json","w"))
