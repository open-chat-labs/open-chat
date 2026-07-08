#!/bin/bash

# Downloads the candidate ONNX models for the personhood verification feasibility
# spike (backend/personhood_spike). See that crate's README for context.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/../backend/personhood_spike/models"
mkdir -p "$MODELS_DIR"
cd "$MODELS_DIR"

download() {
    local file=$1
    local sha256=$2
    local url=$3

    if [ -f "$file" ] && echo "$sha256  $file" | shasum -a 256 -c - > /dev/null 2>&1; then
        echo "$file already present"
        return
    fi
    echo "Downloading $file"
    curl -sL --fail -o "$file" "$url"
    echo "$sha256  $file" | shasum -a 256 -c -
}

download version-RFB-320.onnx \
    34cd7e60aeff28744c657de7a3dc64e872d506741de66987f3426f2b79f88017 \
    "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/ultraface/models/version-RFB-320.onnx"

download 2d106det.onnx \
    f001b856447c413801ef5c42091ed0cd516fcd21f2d6b79635b1e733a7109dbf \
    "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_l/2d106det.onnx"

download det_500m.onnx \
    5e4447f50245bbd7966bd6c0fa52938c61474a04ec7def48753668a9d8b4ea3a \
    "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_sc/det_500m.onnx"

download w600k_mbf.onnx \
    9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f \
    "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_sc/w600k_mbf.onnx"

echo "All models present in $MODELS_DIR"
