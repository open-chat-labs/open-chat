#!/bin/bash

# Builds the canister wasms the integration tests use into wasms/, rebuilding only the canisters
# whose inputs have changed. Each wasm built is kept in a cache shared by every worktree on this
# machine, keyed by a hash of everything the build reads, so a canister which is the same as one
# built before, in any worktree or on any branch, is copied from the cache rather than rebuilt.
#
# Takes the canisters to build as arguments, or builds all of them if there are none. With
# `--dry-run` first, it only reports which canisters would be copied from the cache or built.
#
# The wasms are built with TEST_BUILD=1 (see generate-all-canister-wasms.sh), so they aren't the
# wasms which would be released. On CI, where there is no cache to share and the build is warmed by
# the cache the integration tests write on master, this builds everything the release way instead.

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# So that sorting, and hence every key, is the same whatever the caller's locale
export LC_ALL=C

DRY_RUN=0
if [ "$1" == "--dry-run" ]
then
  DRY_RUN=1
  shift
fi

if [ -n "${CI}" ] && [ ${DRY_RUN} -eq 0 ]
then
  exec ./scripts/generate-all-canister-wasms.sh "$@"
fi

if ! command -v jq &> /dev/null
then
  echo "Please install jq then try again (https://jqlang.org/download)"
  exit 1
fi

if [ -n "${OC_TEST_WASM_CACHE_DIR}" ]
then
  CACHE_DIR="${OC_TEST_WASM_CACHE_DIR}"
elif [ "$(uname)" == "Darwin" ]
then
  CACHE_DIR="${HOME}/Library/Caches/openchat/test-wasms"
else
  CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/openchat/test-wasms"
fi
# How many wasms to keep per canister, the least recently used being removed first
CACHE_ENTRIES_PER_CANISTER=20
mkdir -p "${CACHE_DIR}" wasms || exit 1

ALL_CANISTERS=($(./scripts/generate-all-canister-wasms.sh --list))
if [ $# -gt 0 ]
then
  CANISTERS=("$@")
else
  CANISTERS=("${ALL_CANISTERS[@]}")
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "${WORK_DIR}"' EXIT

# The workspace crates (as directories relative to the repo root) each canister depends on,
# directly or not, when built for wasm, including itself and any proc macros. And the other crates
# it depends on, by id, which includes their version and source.
cargo metadata --format-version 1 --locked --filter-platform wasm32-unknown-unknown > "${WORK_DIR}/metadata.json" || exit 1
ROOT=$(pwd)
for CANISTER in "${ALL_CANISTERS[@]}"
do
  jq -r --arg pkg "${CANISTER}_canister_impl" --arg root "${ROOT}/" '
    (.resolve.nodes | map({key: .id, value: [.deps[] | select(any(.dep_kinds[]; .kind != "dev")) | .pkg]}) | from_entries) as $graph
    | (.packages | map(select(.source == null)) | map({key: .id, value: (.manifest_path | sub("/Cargo.toml$"; "") | ltrimstr($root))}) | from_entries) as $local
    | def closure: . as $ids | ([$ids[] | $graph[.][]?] + $ids | unique) as $next | if ($next | length) == ($ids | length) then $ids else ($next | closure) end;
    [.packages[] | select(.name == $pkg) | .id] | closure
    | (map($local[.] // empty) | .[] | "dir " + .), (map(select($local[.] == null)) | .[] | "dep " + .)
  ' "${WORK_DIR}/metadata.json" > "${WORK_DIR}/${CANISTER}.closure" || exit 1
  sed -n 's/^dir //p' "${WORK_DIR}/${CANISTER}.closure" > "${WORK_DIR}/${CANISTER}.dirs"
  sed -n 's/^dep //p' "${WORK_DIR}/${CANISTER}.closure" | sort > "${WORK_DIR}/${CANISTER}.deps"
  if [ ! -s "${WORK_DIR}/${CANISTER}.dirs" ]
  then
    echo "No crate found for canister ${CANISTER}"
    exit 1
  fi
done

# Every crate directory any canister depends on
ALL_DIRS=($(cat "${WORK_DIR}"/*.dirs | sort -u))

# Writes the key of each canister given to "${WORK_DIR}/<canister>.key", hashing the files as they
# are at the time it's called
compute_keys() {
  # The files the crates embed with `include_bytes!` or `include_str!` from outside their own
  # directories (eg. the LocalUserIndex embeds the CyclesRefunder's wasm), as "<source file>
  # <embedded file>" pairs relative to the repo root
  git grep --untracked -nE 'include_(bytes|str)!\("\.\./' -- "${ALL_DIRS[@]/%//*.rs}" \
    | sed -E 's/^([^:]+):[0-9]+:.*include_(bytes|str)!\("([^"]+)".*/\1 \3/' \
    | while read -r SOURCE EMBEDDED
      do
        echo "${SOURCE} $(cd "$(dirname "${SOURCE}")/$(dirname "${EMBEDDED}")" 2>/dev/null && pwd | sed "s|^${ROOT}/||")/$(basename "${EMBEDDED}")"
      done > "${WORK_DIR}/embedded"

  # The hash of every file which could be an input, tracked or not, uncommitted changes included
  git ls-files -co --exclude-standard -- "${ALL_DIRS[@]}" | while read -r f; do [ -f "$f" ] && echo "$f"; done > "${WORK_DIR}/files"
  git hash-object --stdin-paths < "${WORK_DIR}/files" | paste -d' ' "${WORK_DIR}/files" - > "${WORK_DIR}/hashes"

  # Inputs every canister shares: the workspace manifest, the toolchain, the build script and its
  # flags, the version of this cache's format, and the manifest of every workspace crate any
  # canister depends on. Cargo unifies features across every canister in a build (see
  # generate-all-canister-wasms.sh), so a change to one crate's dependencies or their features can
  # change the others' wasms. The dependency versions each canister uses are part of its own key.
  local COMMON_KEY
  COMMON_KEY=$(
    {
      echo "format 3"
      for f in Cargo.toml rust-toolchain.toml .cargo/config.toml scripts/generate-all-canister-wasms.sh
      do
        echo "$f $(git hash-object "$f")"
      done
      for d in "${ALL_DIRS[@]}"
      do
        echo "$d/Cargo.toml $(git hash-object "$d/Cargo.toml")"
      done
      rustc -vV
    } | shasum -a 256 | cut -d' ' -f1
  )

  local CANISTER DIRS
  for CANISTER in "$@"
  do
    DIRS=$(tr '\n' ' ' < "${WORK_DIR}/${CANISTER}.dirs")
    {
      echo "${COMMON_KEY}"
      echo "${CANISTER}"
      cat "${WORK_DIR}/${CANISTER}.deps"
      # The files in the canister's crates, and those they embed from elsewhere
      awk -v dirs="${DIRS}" 'BEGIN { n = split(dirs, d, " ") } { for (i = 1; i <= n; i++) if (index($1, d[i] "/") == 1) { print; next } }' "${WORK_DIR}/hashes"
      awk -v dirs="${DIRS}" 'BEGIN { n = split(dirs, d, " ") } { for (i = 1; i <= n; i++) if (index($1, d[i] "/") == 1) { print $2; next } }' "${WORK_DIR}/embedded" \
        | sort -u | while read -r f; do echo "${f} $(git hash-object "${f}")"; done
    } | shasum -a 256 | cut -d' ' -f1 > "${WORK_DIR}/${CANISTER}.key"
  done
}

compute_keys "${CANISTERS[@]}"

MISSES=()
for CANISTER in "${CANISTERS[@]}"
do
  KEY=$(cat "${WORK_DIR}/${CANISTER}.key")
  CACHED="${CACHE_DIR}/${CANISTER}-${KEY}.wasm.gz"
  if [ ${DRY_RUN} -eq 1 ]
  then
    [ -f "${CACHED}" ] && echo "${CANISTER}: in the cache (${KEY:0:12})" || echo "${CANISTER}: to build (${KEY:0:12})"
  # Built if it isn't in the cache, or was removed by another worktree between these two steps
  elif [ -f "${CACHED}" ] && cp "${CACHED}" "wasms/${CANISTER}.wasm.gz" 2>/dev/null
  then
    # Marks it as recently used, so that it's the last to be removed
    touch "${CACHED}"
    echo "${CANISTER}: unchanged, copied from the cache"
  else
    MISSES+=("${CANISTER}")
  fi
done

if [ ${DRY_RUN} -eq 1 ]
then
  exit 0
elif [ ${#MISSES[@]} -eq 0 ]
then
  echo "Every wasm was in the cache"
  exit 0
fi

echo "Building ${MISSES[*]}"
for CANISTER in "${MISSES[@]}"
do
  mv "${WORK_DIR}/${CANISTER}.key" "${WORK_DIR}/${CANISTER}.key.before"
done
TEST_BUILD=1 ./scripts/generate-all-canister-wasms.sh "${MISSES[@]}" || exit 1

# A wasm is only cached if its inputs didn't change while it was being built, since it could then
# have been built from either version of them
compute_keys "${MISSES[@]}"
for CANISTER in "${MISSES[@]}"
do
  KEY=$(cat "${WORK_DIR}/${CANISTER}.key")
  if [ "${KEY}" != "$(cat "${WORK_DIR}/${CANISTER}.key.before")" ]
  then
    echo "${CANISTER}: its inputs changed during the build, so it isn't cached"
    continue
  fi
  # Written under a temporary name then renamed, so that a build running at the same time in
  # another worktree never reads a partly written file
  cp "wasms/${CANISTER}.wasm.gz" "${CACHE_DIR}/.${CANISTER}-${KEY}.$$" \
    && mv "${CACHE_DIR}/.${CANISTER}-${KEY}.$$" "${CACHE_DIR}/${CANISTER}-${KEY}.wasm.gz" \
    || exit 1
  ls -t "${CACHE_DIR}/${CANISTER}"-*.wasm.gz | tail -n +$((CACHE_ENTRIES_PER_CANISTER + 1)) | xargs rm -f
done
