#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd "$SCRIPT_DIR/.." || exit 1

# Build every generator in one go (see the comments in the script). Sets CANDID_FILES and TARGET_DIR.
source ./scripts/build-candid-generators.sh || exit 1

# Run the binaries directly rather than via `cargo run -p`: cargo resolves dependency features per
# invocation, so a single-package `cargo run` would want a different build of the shared
# dependencies from the one the batched build just produced, and rebuild them.
for candid in "${CANDID_FILES[@]}"
do
  canister_path=$(dirname "$(dirname "$candid")")
  canister_name=${canister_path##*/}

  echo validating ${candid}
  "${TARGET_DIR}/debug/${canister_name}_canister" > temp.did || exit 1
  didc check --strict "${candid}" temp.did || exit 1
  didc check --strict temp.did "${candid}" || exit 1
done

rm temp.did
