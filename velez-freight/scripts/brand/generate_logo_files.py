# Writes logo-paths.ts, public/brand/*.svg and the app icon from logo-paths.json.
import json, pathlib
HERE=pathlib.Path(__file__).resolve().parent
p=json.load(open(HERE/"logo-paths.json"))
R=str(HERE.parent.parent)+"/"
VB="195 48 1781 633"; MVB="540 50 1065 255"
ts=['// Vector trace of the owner supplied logo artwork (Velez Freight Group, supplied as a',
    '// high resolution PNG). Coordinates are in the source image pixel space. Generated; do not edit by hand.',
    'export const LOGO = {', f'  viewBox: "{VB}",', f'  markViewBox: "{MVB}",']
for k in ("wings","road","lines","lettering","rules"): ts.append(f'  {k}: "{p[k]}",')
ts.append('} as const;')
open(R+"src/components/site/logo-paths.ts","w").write("\n".join(ts)+"\n")
NAVY,RED,WHITE="#142839","#E1252F","#FFFFFF"
def full(road,lines,text,label=True):
  a=' role="img" aria-label="Velez Freight Group"' if label else ''
  return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}"{a}>'
    f'<path fill="{RED}" d="{p["wings"]}{p["rules"]}"/><path fill="{road}" d="{p["road"]}"/>'
    f'<path fill="{lines}" d="{p["lines"]}"/><path fill="{text}" d="{p["lettering"]}"/></svg>\n')
open(R+"public/brand/logo-primary.svg","w").write(full(NAVY,WHITE,NAVY))
open(R+"public/brand/logo-reverse.svg","w").write(full(WHITE,NAVY,WHITE))
open(R+"public/brand/logo-mark.svg","w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{MVB}" role="img" aria-label="Velez Freight Group"><path fill="{RED}" d="{p["wings"]}"/><path fill="{NAVY}" d="{p["road"]}"/><path fill="{WHITE}" d="{p["lines"]}"/></svg>\n')
# App icon: road symbol only, scaled uniformly (no distortion), on navy.
s=0.76; cx,cy=(789+1376)/2,(56+284)/2
open(R+"src/app/icon.svg","w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="{NAVY}"/><g transform="translate(256 256) scale({s}) translate({-cx} {-cy})"><path fill="{WHITE}" d="{p["road"]}"/><path fill="{NAVY}" d="{p["lines"]}"/></g></svg>\n')
