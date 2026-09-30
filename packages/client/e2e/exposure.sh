#!/usr/bin/env bash
# Usage: bash e2e/exposure.sh <out.png>  → mean luminance (0-255) and % near-white of card and tag
set -e
out=${1:-/tmp/exposure.png}
json=$(node "$(dirname "$0")/menu.exposure.mjs" "$out" | tail -1)
read cx cy tx ty < <(python3 -c "import json,sys;d=json.loads(sys.argv[1]);print(int(d['card']['x']),int(d['card']['y']),int(d['tag']['x']),int(d['tag']['y']))" "$json")
for spec in "card $((cx-30)) $((cy-45)) 60 90" "tag $((tx-30)) $((ty-8)) 60 16"; do
  set -- $spec
  mean=$(magick "$out" -crop ${4}x${5}+${2}+${3} -colorspace Gray -format "%[fx:round(mean*255)]" info:)
  burnt=$(magick "$out" -crop ${4}x${5}+${2}+${3} -colorspace Gray -threshold 93% -format "%[fx:round(mean*100)]" info:)
  echo "$1: mean=$mean burnt=${burnt}%"
done
