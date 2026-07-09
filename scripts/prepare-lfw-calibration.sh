#!/bin/bash

# Downloads the LFW (Labeled Faces in the Wild) face dataset and converts its
# pairs list into the format the threshold_calibration tool expects, then
# prints the command to run the calibration. See
# backend/tools/threshold_calibration/README.md for context (#9072).
#
# Usage: ./scripts/prepare-lfw-calibration.sh [TARGET_DIR]
# TARGET_DIR defaults to ./.calibration (gitignored scratch space).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
TARGET="${1:-$ROOT/.calibration}"
mkdir -p "$TARGET"
cd "$TARGET"

LFW_URL="https://vis-www.cs.umass.edu/lfw/lfw.tgz"
PAIRS_URL="https://vis-www.cs.umass.edu/lfw/pairs.txt"

if [ ! -d "lfw" ]; then
    echo "Downloading LFW images (~173 MB)..."
    curl -L --fail -o lfw.tgz "$LFW_URL"
    echo "Extracting..."
    tar -xzf lfw.tgz
    rm -f lfw.tgz
fi

if [ ! -f "pairs.txt" ]; then
    echo "Downloading pairs list..."
    curl -L --fail -o pairs.txt "$PAIRS_URL"
fi

echo "Converting pairs.txt to the calibration format..."
python3 - "$TARGET/pairs.txt" "$TARGET/pairs.calib.txt" << 'PY'
import sys

src, dst = sys.argv[1], sys.argv[2]
lines = [l.rstrip("\n") for l in open(src) if l.strip()]

# First line is "<num_folds> <pairs_per_fold>"; skip it if it parses as two ints
start = 0
first = lines[0].split()
if len(first) == 2 and all(t.isdigit() for t in first):
    start = 1

def img(name, n):
    return f"lfw/{name}/{name}_{int(n):04d}.jpg"

out = []
for line in lines[start:]:
    parts = line.split()
    if len(parts) == 3:  # matched: same person, two image numbers
        name, a, b = parts
        out.append(f"same {img(name, a)} {img(name, b)}")
    elif len(parts) == 4:  # mismatched: two different people
        n1, a, n2, b = parts
        out.append(f"diff {img(n1, a)} {img(n2, b)}")

open(dst, "w").write("\n".join(out) + "\n")
same = sum(1 for l in out if l.startswith("same"))
diff = sum(1 for l in out if l.startswith("diff"))
print(f"  wrote {len(out)} pairs ({same} same, {diff} diff)")
PY

echo
echo "Done. Run the calibration with:"
echo
echo "  ./scripts/download-personhood-spike-models.sh"
echo "  cargo run -p threshold_calibration --release -- \\"
echo "    --models-dir ./backend/personhood_spike/models \\"
echo "    --images-dir $TARGET \\"
echo "    --pairs $TARGET/pairs.calib.txt"
