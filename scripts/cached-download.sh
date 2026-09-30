#!/bin/bash

# Downloads URL to OUTPUT, keeping a copy in a cache shared by every worktree on this machine so
# that it's only ever downloaded once. Only for URLs whose content never changes, such as a
# versioned release or the build of a given commit. On CI it always downloads.
#
# Exits non-zero, having written nothing, if the download fails.

URL=$1
OUTPUT=$2

if [ -z "${URL}" ] || [ -z "${OUTPUT}" ]
then
  echo "Usage: cached-download.sh <url> <output file>"
  exit 1
fi

if [ -n "${CI}" ]
then
  curl -sSfL "${URL}" -o "${OUTPUT}"
  exit $?
fi

if [ -n "${OC_DOWNLOAD_CACHE_DIR}" ]
then
  CACHE_DIR="${OC_DOWNLOAD_CACHE_DIR}"
elif [ "$(uname)" == "Darwin" ]
then
  CACHE_DIR="${HOME}/Library/Caches/openchat/downloads"
else
  CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/openchat/downloads"
fi
mkdir -p "${CACHE_DIR}" || exit 1

CACHED="${CACHE_DIR}/$(echo -n "${URL}" | shasum -a 256 | cut -d' ' -f1)"
if [ ! -f "${CACHED}" ]
then
  # Downloaded under a temporary name then renamed, so that a download running at the same time
  # in another worktree never reads a partly written file
  curl -sSfL "${URL}" -o "${CACHED}.$$" && mv "${CACHED}.$$" "${CACHED}" || { rm -f "${CACHED}.$$"; exit 1; }
fi
cp "${CACHED}" "${OUTPUT}"
