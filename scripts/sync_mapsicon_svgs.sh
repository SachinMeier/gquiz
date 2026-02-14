#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p vendor
if [ ! -d vendor/mapsicon/.git ]; then
  git clone --depth 1 https://github.com/djaiss/mapsicon.git vendor/mapsicon
else
  git -C vendor/mapsicon pull --ff-only
fi

mkdir -p country-shapes
rsync -a --delete \
  --include '*/' --include '*.svg' --exclude '*' \
  vendor/mapsicon/ country-shapes/

python3 - <<'PY'
import json, os
root='country-shapes'
items=[]
for dp,_,files in os.walk(root):
    for f in files:
        if f.lower().endswith('.svg'):
            full=os.path.join(dp,f)
            rel=os.path.relpath(full, '.').replace('\\','/')
            parent=os.path.basename(os.path.dirname(full))
            code=parent.upper()
            items.append({'path':'/'+rel,'fileName':f,'code':code})
items.sort(key=lambda x:(x['code'],x['path']))
with open('country-shapes/manifest.json','w') as fp:
    json.dump(items,fp)
print(f"Synced {len(items)} SVGs")
PY
