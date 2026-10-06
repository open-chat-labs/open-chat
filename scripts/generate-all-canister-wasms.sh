#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

if [ -z "${CARGO_HOME}" ]
then
  export CARGO_HOME="${HOME}/.cargo"
fi

# With TEST_BUILD=1 (see generate-test-wasms.sh) the wasms are built for the integration tests
# rather than for release: the commit id they embed is fixed, so that a new commit doesn't rebuild
# every canister, and the flags below don't name the worktree, so that sccache can share compiled
# crates between worktrees. No test reads either
if [ "${TEST_BUILD}" == "1" ]
then
  export GIT_COMMIT_ID="test-build"
elif [ -z "${GIT_COMMIT_ID}" ]
then
  export GIT_COMMIT_ID=$(git rev-parse HEAD)
fi

ALL_CANISTERS=(
  community
  cycles_dispenser
  daily_puzzle
  escrow
  event_relay
  group
  group_index
  identity
  local_user_index
  market_maker
  multi_user
  neuron_controller
  notifications_index
  online_users
  openchat_installer
  proposal_validation
  proposals_bot
  registry
  sign_in_with_email
  storage_bucket
  storage_index
  translations
  user
  user_index
)

# Builds the canisters given as arguments, or all of them if there are none. `--list` prints them.
if [ "$1" == "--list" ]
then
  printf '%s\n' "${ALL_CANISTERS[@]}"
  exit 0
elif [ $# -gt 0 ]
then
  CANISTERS=("$@")
else
  CANISTERS=("${ALL_CANISTERS[@]}")
fi

# Install ic-wasm before RUSTFLAGS is set below: those flags are for the wasm target only, and
# the `getrandom_backend="custom"` cfg in particular makes a native build fail to link. This checks
# the binary itself rather than `cargo install --list`, since the Dockerfile installs the release
# binary directly; `--force` then replaces any other version there, however it was installed.
if [ "$(${CARGO_HOME}/bin/ic-wasm --version 2>/dev/null)" != "ic-wasm 0.9.11" ]
then
  echo Installing ic-wasm
  cargo install --force --version 0.9.11 ic-wasm || exit 1
fi

echo Building wasms
# `--cfg getrandom_backend="custom"` selects getrandom's custom backend on wasm (see
# .cargo/config.toml). Setting RUSTFLAGS here means cargo ignores that config file, so the cfg has
# to be repeated in the flags below.
if [ "${TEST_BUILD}" == "1" ]
then
  export RUSTFLAGS="--cfg getrandom_backend=\"custom\" --remap-path-prefix ${CARGO_HOME}/bin=/cargo/bin --remap-path-prefix ${CARGO_HOME}/git=/cargo/git"
else
  export RUSTFLAGS="--cfg getrandom_backend=\"custom\" --remap-path-prefix $(readlink -f ${SCRIPT_DIR}/..)=/build --remap-path-prefix ${CARGO_HOME}/bin=/cargo/bin --remap-path-prefix ${CARGO_HOME}/git=/cargo/git"
fi
# The remap below depends on the registry sources being unpacked. On a fresh machine they aren't
# until something is built, and a restored CI cache holds the directory but not its contents, so
# without this the flags (and hence every cached artifact's fingerprint) would differ between runs.
cargo metadata --format-version 1 --locked > /dev/null || exit 1
for l in $(ls ${CARGO_HOME}/registry/src/)
do
  export RUSTFLAGS="--remap-path-prefix ${CARGO_HOME}/registry/src/${l}=/cargo/registry/src/github ${RUSTFLAGS}"
done

# Cargo unifies the features of the dependencies of every package in a build, so building only
# some canisters can give them different features, and so different wasms, from building them all
# (eg. the LocalUserIndex built alone is over the size limit). So every canister is always
# compiled, and only those asked for are optimised, so that a canister's wasm is the same however
# it was built, and matches the released wasm (see docker-build-all-wasms.sh).
PACKAGES=()
for CANISTER in "${ALL_CANISTERS[@]}"; do
  PACKAGES+=(--package "${CANISTER}_canister_impl")
done
cargo build --locked --target wasm32-unknown-unknown --release "${PACKAGES[@]}" || exit 1

echo Optimising and compressing wasms
mkdir -p wasms

# The IC refuses to install a wasm whose code section is larger than this
MAX_CODE_SECTION_SIZE=12582912
# The build fails once a canister's code is this close to that limit, so that it's caught while
# there's still room to ship. Seemingly unrelated changes can add hundreds of KBs, eg. a new
# dependency between two crates can change which crate's copy of a generic instance each links
# to (see backend/libraries/types/src/msgpack_instances.rs)
CODE_SECTION_SIZE_MARGIN=1048576

# Prints the size of the code section (id 10) of the wasm given, reading each section's header (its
# id, then its size as a LEB128 encoded u32) to skip to the next. In bash, since the docker image
# the release builds run in has no python
code_section_size() {
  local WASM=$1 OFFSET=8 FILE_SIZE ID SIZE SHIFT BYTE I
  local -a BYTES
  FILE_SIZE=$(($(wc -c < "${WASM}")))
  while [ "${OFFSET}" -lt "${FILE_SIZE}" ]
  do
    BYTES=($(od -An -tu1 -j "${OFFSET}" -N 6 "${WASM}"))
    [ "${#BYTES[@]}" -ge 2 ] || break
    ID=${BYTES[0]}
    SIZE=0
    SHIFT=0
    I=1
    while true
    do
      BYTE=${BYTES[$I]}
      I=$((I + 1))
      SIZE=$((SIZE | ((BYTE & 127) << SHIFT)))
      SHIFT=$((SHIFT + 7))
      [ $((BYTE & 128)) -eq 0 ] && break
    done
    if [ "${ID}" -eq 10 ]
    then
      echo "${SIZE}"
      return
    fi
    OFFSET=$((OFFSET + I + SIZE))
  done
  echo 0
}

optimise_and_compress() {
  CANISTER=$1
  PACKAGE="${CANISTER}_canister_impl"
  # Invoke the version installed above rather than whatever is first on the PATH - a different
  # `ic-wasm` there (eg. from a package manager) may not take the same arguments, and this would
  # then silently reuse the `-opt.wasm` left behind by an earlier build
  ${CARGO_HOME}/bin/ic-wasm ./target/wasm32-unknown-unknown/release/$PACKAGE.wasm -o ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm shrink || exit 1
  ${CARGO_HOME}/bin/ic-wasm ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm -o ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm optimize Oz || exit 1
  CODE_SIZE=$(code_section_size ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm)
  if ! [ "${CODE_SIZE:-0}" -gt 0 ] 2>/dev/null
  then
    echo "Failed to read the size of the code section of the $CANISTER wasm"
    exit 1
  elif [ "${CODE_SIZE}" -gt "${MAX_CODE_SECTION_SIZE}" ]
  then
    echo "The code section of the $CANISTER wasm is $CODE_SIZE bytes, over the IC's limit of $MAX_CODE_SECTION_SIZE bytes"
    exit 1
  elif [ "${CODE_SIZE}" -gt $((MAX_CODE_SECTION_SIZE - CODE_SECTION_SIZE_MARGIN)) ]
  then
    echo "The code section of the $CANISTER wasm is $CODE_SIZE bytes, within $CODE_SECTION_SIZE_MARGIN bytes of the IC's limit of $MAX_CODE_SECTION_SIZE bytes"
    exit 1
  fi
  gzip -fckn9 target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm > ./wasms/$CANISTER.wasm.gz || exit 1
  echo "Optimised $CANISTER (code section $CODE_SIZE bytes)"
}
export -f code_section_size optimise_and_compress
export CARGO_HOME MAX_CODE_SECTION_SIZE CODE_SECTION_SIZE_MARGIN

# Each canister is independent, so optimise them in parallel (one at a time this step takes
# several minutes). `xargs` exits non-zero if any invocation fails.
JOBS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
printf '%s\n' "${CANISTERS[@]}" | xargs -P "$JOBS" -I{} bash -c 'optimise_and_compress "$1"' _ {} || exit 1

echo Finished generating wasms