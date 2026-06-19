#!/usr/bin/env bash
# Fetch the static visual assets for the templates from Figma via the REST API.
# One-time / re-run when the Figma design changes. Requires a Figma token.
#
# Usage:
#   FIGMA_TOKEN=figd_xxx ./scripts/fetch-assets.sh
#   ./scripts/fetch-assets.sh figd_xxx
#
# After running, run `node scripts/build-assets.mjs` to inline the assets.
set -euo pipefail

TOKEN="${1:-${FIGMA_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: pass a Figma token as \$1 or set FIGMA_TOKEN." >&2
  exit 1
fi

FILE_KEY="61SfzG7xiYlR5YUheV82F9"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets-src"
mkdir -p "$OUT"

api() { curl -s -H "X-Figma-Token: $TOKEN" "$1"; }

# Resolve a node-id export URL (format=svg|png, optional scale) and download it.
dl() { # node_id  format  scale  outfile
  local id="$1" fmt="$2" scale="$3" out="$4"
  local url
  url=$(api "https://api.figma.com/v1/images/${FILE_KEY}?ids=${id}&format=${fmt}&scale=${scale}" \
        | python3 -c "import sys,json;print(json.load(sys.stdin)['images']['${id}'])")
  if [[ "$url" == "None" || -z "$url" ]]; then echo "ERROR: no export URL for $id" >&2; exit 1; fi
  curl -s "$url" -o "$out"
  echo "  $out"
}

echo "Fetching SVG/PNG assets from Figma..."
dl "1211:3579" svg 1 "$OUT/illustration.svg"   # white HA icon pattern
dl "1211:4581" svg 1 "$OUT/ha-lockup.svg"      # Home Assistant logo
dl "1211:4575" svg 1 "$OUT/ohf-logo.svg"       # Open Home Foundation logo
dl "1211:3577" png 1 "$OUT/gradient-full.png"  # teal gradient group, full 3932² @1x

# The gradient group node is 3932px placed at offset (-1088,-1717) inside the 1080² frame,
# so the visible window is node-relative (1088,1717) size 1080. Derive the crop from the
# image's ACTUAL pixel width (Figma may cap large exports) so it's correct at any scale.
echo "Cropping gradient to the visible 1080 window..."
GW=$(sips -g pixelWidth "$OUT/gradient-full.png" 2>/dev/null | tail -1 | awk '{print $2}')
read OY OX SZ < <(python3 -c "s=$GW/3932.0; print(round(1717*s), round(1088*s), round(1080*s))")
sips --cropOffset "$OY" "$OX" -c "$SZ" "$SZ" "$OUT/gradient-full.png" --out "$OUT/gradient.png" >/dev/null
rm -f "$OUT/gradient-full.png"
echo "  $OUT/gradient.png"

# Figtree webfont (Google Fonts). Latin woff2, weights 400 & 700.
echo "Fetching Figtree woff2 (400, 700)..."
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
CSS_TMP="$(mktemp)"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Figtree:wght@400;700&display=swap" -o "$CSS_TMP"
# Grab the latin woff2 url per weight block.
python3 - "$OUT" "$CSS_TMP" <<'PY'
import sys, re, urllib.request
out = sys.argv[1]
css = open(sys.argv[2]).read()
# Split into @font-face blocks; keep latin (unicode-range with U+0000) blocks per weight.
blocks = re.findall(r'@font-face\s*{[^}]*}', css)
want = {400: None, 700: None}
for b in blocks:
    w = re.search(r'font-weight:\s*(\d+)', b)
    u = re.search(r'url\((https://[^)]+\.woff2)\)', b)
    if not (w and u): continue
    weight = int(w.group(1))
    # prefer the 'latin' block (the one whose unicode-range starts at U+0000)
    is_latin = 'U+0000' in b
    if weight in want and (want[weight] is None or is_latin):
        want[weight] = (u.group(1), is_latin)
for weight, val in want.items():
    if not val: raise SystemExit(f"no woff2 found for weight {weight}")
    url = val[0]
    dest = f"{out}/figtree-{weight}.woff2"
    urllib.request.urlretrieve(url, dest)
    print(f"  {dest}")
PY
rm -f "$CSS_TMP"

echo "Done. Now run: node scripts/build-assets.mjs"
