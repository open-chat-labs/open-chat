#!/bin/bash

# Downloads the LFW (Labeled Faces in the Wild) face dataset and converts its
# pairs list into the format the threshold_calibration tool expects, then
# prints the command to run the calibration. See
# backend/tools/threshold_calibration/README.md for context (#9072).
#
# It fetches LFW via scikit-learn's loader, which mirrors the dataset on
# figshare (the umass.edu host is frequently down). Requires scikit-learn:
#   pip install scikit-learn
#
# Usage: ./scripts/prepare-lfw-calibration.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

if ! python3 -c "import sklearn" 2>/dev/null; then
    echo "scikit-learn is required. Install it with:"
    echo "  pip install scikit-learn"
    exit 1
fi

python3 - "$ROOT/.calibration/pairs.calib.txt" << 'PY'
import os
import sys
from sklearn.datasets import fetch_lfw_people, fetch_lfw_pairs

dst = sys.argv[1]
os.makedirs(os.path.dirname(dst), exist_ok=True)

print("Downloading LFW images via the scikit-learn mirror (~200 MB, one-time)...")
# Triggers download + extraction of the funneled JPEGs to disk
fetch_lfw_people(funneled=True, download_if_missing=True, min_faces_per_person=0)
# Ensures the pairs list (all 10 folds = 6000 pairs) is present
fetch_lfw_pairs(subset="10_folds", funneled=True, download_if_missing=True)

data_home = os.environ.get("SCIKIT_LEARN_DATA", os.path.expanduser("~/scikit_learn_data"))
lfw_home = os.path.join(data_home, "lfw_home")
images_root = os.path.join(lfw_home, "lfw_funneled")
pairs_file = os.path.join(lfw_home, "pairs.txt")
assert os.path.isdir(images_root), f"expected {images_root}"
assert os.path.isfile(pairs_file), f"expected {pairs_file}"

def img(name, n):
    return f"lfw_funneled/{name}/{name}_{int(n):04d}.jpg"

lines = [l.rstrip("\n") for l in open(pairs_file) if l.strip()]
start = 1 if len(lines[0].split()) == 2 and all(t.isdigit() for t in lines[0].split()) else 0

out = []
for line in lines[start:]:
    p = line.split()
    if len(p) == 3:      # matched: same person
        out.append(f"same {img(p[0], p[1])} {img(p[0], p[2])}")
    elif len(p) == 4:    # mismatched: different people
        out.append(f"diff {img(p[0], p[1])} {img(p[2], p[3])}")

open(dst, "w").write("\n".join(out) + "\n")
same = sum(l.startswith("same") for l in out)
diff = sum(l.startswith("diff") for l in out)
print(f"Wrote {len(out)} pairs ({same} same, {diff} diff) to {dst}")
print(f"Images root: {images_root}")
# Stash the images root so the shell can print the run command
open(dst + ".imgroot", "w").write(lfw_home)
PY

IMG_ROOT="$(cat "$ROOT/.calibration/pairs.calib.txt.imgroot")"

echo
echo "Done. Run the calibration with:"
echo
echo "  ./scripts/download-personhood-spike-models.sh"
echo "  cargo run -p threshold_calibration --release -- \\"
echo "    --models-dir ./backend/personhood_spike/models \\"
echo "    --images-dir $IMG_ROOT \\"
echo "    --pairs $ROOT/.calibration/pairs.calib.txt"
