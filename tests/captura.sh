#!/usr/bin/env bash
# Captura de una pantalla a 390 px: bash tests/captura.sh <salida.png> <hash> [light|dark] [página]
# Necesita el servidor en marcha: python -m http.server 8790 (desde la raíz del proyecto).
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PROFILE="$(mktemp -d)"
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir="$PROFILE" \
  --window-size=390,1700 --virtual-time-budget=4000 --screenshot="$1" \
  "http://127.0.0.1:8790/tests/frames.html?h=$2&t=$3&p=${4:-../app/index.html}" 2>/dev/null
rm -rf "$PROFILE" 2>/dev/null
