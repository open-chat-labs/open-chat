#!/bin/bash

# Populates frontend/app/public/assets/verification with the self-hosted
# MediaPipe assets used by the human verification capture flow (#9072).
# The wasm runtime comes from node_modules; the face_landmarker model is
# downloaded (hash-pinned) since it is not part of the npm package.
# Everything is lazy-loaded by the app only when the flow opens.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
TARGET_DIR="$FRONTEND_DIR/app/public/assets/verification"
WASM_DIR="$FRONTEND_DIR/node_modules/@mediapipe/tasks-vision/wasm"

MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_SHA256="64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"

mkdir -p "$TARGET_DIR"

for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm; do
    if [ ! -f "$TARGET_DIR/$f" ] || ! cmp -s "$WASM_DIR/$f" "$TARGET_DIR/$f"; then
        cp "$WASM_DIR/$f" "$TARGET_DIR/$f"
    fi
done

if [ -f "$TARGET_DIR/face_landmarker.task" ] &&
    echo "$MODEL_SHA256  $TARGET_DIR/face_landmarker.task" | shasum -a 256 -c - > /dev/null 2>&1; then
    exit 0
fi

echo "Downloading face_landmarker.task"
curl -sL --fail -o "$TARGET_DIR/face_landmarker.task" "$MODEL_URL"
echo "$MODEL_SHA256  $TARGET_DIR/face_landmarker.task" | shasum -a 256 -c -
