#!/usr/bin/env bash
set -Eeuo pipefail

# Copies the benchmark results CI measured for the commit checked out into canbench_results.yml, to
# commit when a change moves the numbers. From Rust 1.99 the benchmark wasm differs by the platform
# it's built on, so `canbench --persist` only gives CI's numbers on Linux x86_64 (locally it's still
# fine for comparing before and after on the same machine). CI's benchmarks job uploads the results
# file it persists on every run (see benchmarks.yaml).
#
# The benchmarks run on pull requests, so push the commit to a PR first. A run in progress is waited
# for. Its numbers are for the PR merged into master, which is what the check compares anyway.

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd "$SCRIPT_DIR/.."

COMMIT=$(git rev-parse HEAD)

RUN_ID=$(gh run list --workflow benchmarks.yaml --commit "$COMMIT" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
if [ -z "$RUN_ID" ]
then
  echo "No Benchmarks run found for $COMMIT. Push it to a PR into master (GitHub doesn't run the checks while a PR has conflicts) and try again once the run has started."
  exit 1
fi

if [ "$(gh run view "$RUN_ID" --json status --jq .status)" != "completed" ]
then
  echo "Waiting for Benchmarks run $RUN_ID to finish"
  gh run watch "$RUN_ID" > /dev/null
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if ! gh run download "$RUN_ID" --name persisted_canbench_results --dir "$TMP_DIR"
then
  # eg. the benchmarks job was skipped (no backend changes), failed before measuring, or the run was
  # cancelled by a newer push
  echo "Benchmarks run $RUN_ID has no results file to download ($(gh run view "$RUN_ID" --json conclusion,url --jq '"\(.conclusion): \(.url)"'))"
  exit 1
fi

cp "$TMP_DIR/canbench_results.yml" canbench_results.yml
echo "Copied the results of Benchmarks run $RUN_ID (commit $COMMIT) into canbench_results.yml"
git diff --stat -- canbench_results.yml
