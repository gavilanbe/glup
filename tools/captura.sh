#!/bin/sh
# Captures one scene at 4x with the installed Google Chrome in headless mode.
#   tools/captura.sh sprites                     hoja de sprites
#   tools/captura.sh titulo [t]                  título tras t fotogramas
#   tools/captura.sh nivel [t] [out] [n] [x]     nivel n, Nila en x píxeles, tras t fotogramas
cd "$(dirname "$0")/.." || exit 1
NAME=${1:-sprites}; T=${2:-0}; OUT=${3:-artifacts/$NAME-$T.png}; N=${4:-0}; X=${5:--1}
CHROME="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p artifacts
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --window-size=1280,720 --enable-logging=stderr --v=0 \
  --virtual-time-budget=3000 --screenshot="$OUT" "file://$PWD/index.html?escena=$NAME&t=$T&n=$N&x=$X&guion=$GUION&debug=1&trucos=$TRUCOS" 2>&1 | grep -E 'CONSOLE' | sed 's/.*CONSOLE/CONSOLE/' | head -40
echo "$OUT"
