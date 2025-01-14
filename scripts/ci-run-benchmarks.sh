#!/usr/bin/env bash
set -Eexuo pipefail

# Script that runs `canbench` at a given directory and outputs a comment
# that is intended to be posted on the pull request.

# Path to run `canbench` from.
CANISTER_PATH=$1

# The name of the job in CI
CANBENCH_JOB_NAME=$2

# Must match the file specified in the github action.
COMMENT_MESSAGE_PATH=/tmp/canbench_result_${CANBENCH_JOB_NAME}

# Github CI is expected to have the main branch checked out in this folder.
MAIN_BRANCH_DIR=_canbench_main_branch

CANBENCH_OUTPUT=/tmp/canbench_output.txt

CANBENCH_RESULTS_FILE="$CANISTER_PATH/canbench_results.yml"
MAIN_BRANCH_RESULTS_FILE="$MAIN_BRANCH_DIR/$CANBENCH_RESULTS_FILE"

# Install canbench
cargo install canbench

# Verify that canbench results are available.
if [ ! -f "$CANBENCH_RESULTS_FILE" ]; then
    echo "$CANBENCH_RESULTS_FILE not found. Did you forget to run \`canbench --persist\`?";
    exit 1
fi

# Detect if canbench results file is up to date.
pushd "$CANISTER_PATH"
canbench --less-verbose > $CANBENCH_OUTPUT
if grep -q "(regress\|(improved by \|(new)" "$CANBENCH_OUTPUT"; then
  UPDATED_MSG="**\`$CANBENCH_RESULTS_FILE\` is not up to date ❌**
  If the performance change is expected, run \`canbench --persist\` to save the updated benchmark results.";

  # canbench results file not up to date. Fail the job.
  echo "EXIT_STATUS=1" >> "$GITHUB_ENV"
else
  UPDATED_MSG="**\`$CANBENCH_RESULTS_FILE\` is up to date ✅**";

  # canbench results file is up to date. The job succeeds.
  echo "EXIT_STATUS=0" >> "$GITHUB_ENV"
fi
popd


echo "# \`canbench\` 🏋 (dir: $CANISTER_PATH)" > "$COMMENT_MESSAGE_PATH"

# Detect if there are performance changes relative to the main branch.
if [ -f "$MAIN_BRANCH_RESULTS_FILE" ]; then
  # Move the results of the main branch into the current branch.
  mv "$MAIN_BRANCH_RESULTS_FILE" "$CANBENCH_RESULTS_FILE"

  # Run canbench to compare result to main branch.
  pushd "$CANISTER_PATH"
  canbench --less-verbose > "$CANBENCH_OUTPUT"
  popd

  if grep -q "(regress\|(improved by" "${CANBENCH_OUTPUT}"; then
    echo "**Significant performance change detected! ⚠️**
    " >> "$COMMENT_MESSAGE_PATH"
  else
    echo "**No significant performance changes detected ✅**
    " >> "$COMMENT_MESSAGE_PATH"
  fi
fi

## Add the output of canbench to the file.
{
  echo "$UPDATED_MSG"
  echo ""
  echo "\`\`\`"
  cat "$CANBENCH_OUTPUT"
  echo "\`\`\`"
} >> "$COMMENT_MESSAGE_PATH"

# Output the comment to stdout.
cat "$COMMENT_MESSAGE_PATH"
