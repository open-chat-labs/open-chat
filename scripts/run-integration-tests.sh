#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

WASM_SRC=${1:-build}
TEST_THREADS=${2:-6}
TESTNAME=$3
POCKET_IC_SERVER_VERSION="16.0.0"

if [[ $OSTYPE == "linux-gnu"* ]] || [[ $RUNNER_OS == "Linux" ]]
then
    PLATFORM=linux
elif [[ $OSTYPE == "darwin"* ]] || [[ $RUNNER_OS == "macOS" ]]
then
    PLATFORM=darwin
else
    echo "OS not supported: ${OSTYPE:-$RUNNER_OS}"
    exit 1
fi

# The x86_64 build runs on Apple Silicon too, but under Rosetta, where the tests take around half
# as long again
if [[ $(uname -m) == "arm64" ]] || [[ $(uname -m) == "aarch64" ]]
then
    ARCH=arm64
else
    ARCH=x86_64
fi

if [[ $WASM_SRC == "build" ]]
then
    # Locally this only rebuilds the canisters which have changed since they were last built in
    # any worktree (see the script). On CI it builds them all.
    ./scripts/generate-test-wasms.sh || exit 1
elif [[ $WASM_SRC != "local" ]]
then
    ./scripts/download-all-canister-wasms.sh $WASM_SRC || exit 1
fi

cd backend/integration_tests
echo "PocketIC download starting"
../../scripts/cached-download.sh https://github.com/dfinity/pocketic/releases/download/${POCKET_IC_SERVER_VERSION}/pocket-ic-${ARCH}-${PLATFORM}.gz pocket-ic.gz || exit 1
gzip -df pocket-ic.gz || exit 1
chmod +x pocket-ic
echo "PocketIC download completed"
cd ../..

./scripts/download-nns-canister-wasm.sh icp_ledger ledger-canister_notify-method
./scripts/download-nns-canister-wasm.sh sns_wasm sns-wasm-canister
./scripts/download-nns-canister-wasm.sh icrc_ledger ic-icrc1-ledger
./scripts/download-canister-wasm-dfx.sh event_store || exit 1

# The User and MultiUser canister wasms currently in production, for testing upgrades from them. The
# release tags are needed to find them, but aren't included in shallow checkouts.
# Worktrees share the repository, so this can fail on its lock while another worktree is fetching,
# in which case the tags fetched before are used
for CANISTER in user multi_user
do
  if ! git fetch --quiet --depth=1 origin "refs/tags/*-$CANISTER:refs/tags/*-$CANISTER"
  then
    if [ -z "$(git tag -l "*-$CANISTER")" ]
    then
      exit 1
    fi
    echo "Failed to fetch the $CANISTER canister's release tags, so using the latest already fetched: $(git tag -l --sort=-version:refname "*-$CANISTER" | head -n 1)"
  fi
  ./scripts/download-canister-wasm.sh $CANISTER prod ${CANISTER}_prod || exit 1
done

function cleanup() {
  rm -rf ./backend/integration_tests/pocket_ic_state
}

trap cleanup EXIT

cargo test --package integration_tests $TESTNAME -- --nocapture --test-threads $TEST_THREADS || exit 1

cleanup
