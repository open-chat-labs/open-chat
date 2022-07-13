#! /usr/bin/env bash

# Originally copied from https://github.com/dfinity-lab/dfinity/blob/a7977163b8a30682897d8edbb3b188e2e9497d02/rs/tests/setup-and-cargo-test.sh

set -eu

if [[ ${TMPDIR-/tmp} == /run/* ]]; then
    echo "Running in nix-shell on Linux, unsetting TMPDIR"
    export TMPDIR=
fi

show_help() {
    echo "Usage: ./run.sh [OPTIONS] [-- FONDUE_OPTIONS]"
    echo ""
    echo "Compiles the replica and nodemanager, sets the binaries up then runs the tests"
    echo ""
    echo "This script must be run from 'backend/integration_tests'. "
    echo ""
    echo "For information on the fondue options run this script with '-- -h'."
    echo ""
    echo "Options:"
    echo "   -i            Runs in interactive mode: first we build the necessary binaries then"
    echo "                 we ask for user confirmation before starting the tests"
    echo ""
    echo "   --no-build    Does not build the replica nor the nodemanager (implies non-interactive)"
    echo ""
    echo "   --debug       Build the binaries in debug mode (ignored if --no-build is specified)"
    echo ""
    echo "   --jobs NUM    Passes '--jobs NUM' to all cargo build commands issued by this script."
    echo ""
}

# If the user does not specifies `-i` on the command line, the test run will start
# immediately without asking the user to press any key.
non_interactive=true

no_build=false

debug=false

jobs_str=""

while [[ $# -ge 1 ]]; do
    case $1 in
        -i)
            non_interactive=false
            shift
            ;;
        --no-build)
            no_build=true
            non_interactive=true
            shift
            ;;
        --debug)
            debug=true
            shift
            ;;
        --jobs)
            shift
            jobs_str="--jobs $1"
            shift
            ;;
        --)
            shift
            break
            ;;
        *)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
    esac
done

if [[ "$debug" == true ]]; then
    release_string=""
    BUILD_DIR="debug"
else
    release_string="--release"
    BUILD_DIR="release"
fi

# Call cleanup() when the user presses Ctrl+C
trap "cleanup" 2

# The shell kills the process group. However, the node manager sets the pgid to
# its own pid. As a result, the nodemanagers and the replicas started by this
# script will not get killed when the user presses Ctrl+C. As a mitigation, ...
# we simply kill all nodemanager and system-tests.
cleanup() {
    echo "Received SIGINT..."
    echo "Sending SIGTERM to 'nodemanager' processes started by this session!"
    for pid in $(pgrep nodemanager); do kill -s SIGTERM "$pid"; done
    echo "Sending SIGTERM to 'system-tests' processes started by this session!"
    for pid in $(pgrep system-tests); do kill -s SIGTERM "$pid"; done
    echo "Sending SIGTERM to 'ic-rosetta-api' processes started by this session!"
    for pid in $(pgrep ic-rosetta-api); do kill -s SIGTERM "$pid"; done
    echo "Sending SIGTERM to 'rosetta-cli' processes started by this session!"
    #I don't think this one is necessay, but just in case...
    for pid in $(pgrep rosetta-cli); do kill -s SIGTERM "$pid"; done
    echo "You can remove rosetta_workspace/rosetta_api_tmp_* dirs after you confirmed rosetta_api finished"
}

currdir=$(basename "$PWD")
if [[ "$currdir" != "integration_tests" ]]; then
    echo "You must run this from the integration_tests directory."
    exit 1
fi

## Determine where the target lives
case $(uname) in
    Darwin) RUST_TRIPLE=x86_64-apple-darwin ;;
    Linux) RUST_TRIPLE=x86_64-unknown-linux-gnu ;;
esac

if [[ "$no_build" != true ]]; then
    ## Build the replica and the nodemanager
    st_build=$(date)
    cargo build ${jobs_str} --package ic-replica --target ${RUST_TRIPLE} ${release_string}
    cargo build ${jobs_str} --package nodemanager --package ic-rosetta-api --target ${RUST_TRIPLE} ${release_string}
    cargo build ${jobs_str}

    ## Build the canister wasms
    pushd ../..
    ./generate-wasm.sh callback_canister_impl
    ./generate-wasm.sh group_canister_impl
    ./generate-wasm.sh group_index_canister_impl
    ./generate-wasm.sh notifications_canister_impl
    ./generate-wasm.sh online_users_aggregator_canister_impl
    ./generate-wasm.sh user_canister_impl
    ./generate-wasm.sh user_index_canister_impl

    ./compress-wasm.sh group_canister_impl
    ./compress-wasm.sh user_canister_impl
    popd

    e_build=$(date)

    echo "Building times:"
    echo "  + $st_build"
    echo "  - $e_build"
fi

## Sets target to the BUILD_DIR subdir of $CARGO_TARGET_DIR if this variable is set.
## If CARGO_TEST_DIR is not set, we use the default $(pwd)/../target instead.
target=${CARGO_TARGET_DIR:-$(pwd)/target}/${RUST_TRIPLE}/${BUILD_DIR}

if [[ ! -f "${target}/replica" ]] || [[ ! -f "${target}/nodemanager" ]]; then
    echo "Make sure that the following files exist:"
    echo "    - ${target}/replica"
    echo "    - ${target}/nodemanager"
    echo "    - ${target}/ic-rosetta-api"
    exit 1
fi

## Make a local-bin directory and link the replica and nodemanager here and copy the canister wasms here
mkdir -p local-bin
ln -fs "${target}/replica" local-bin/
ln -fs "${target}/nodemanager" local-bin/
ln -fs "${target}/replica" local-bin/replica_base
ln -fs "${target}/nodemanager" local-bin/nodemanager_base
ln -fs "${target}/ic-rosetta-api" local-bin/

ln -fs ../../../target/wasm32-unknown-unknown/release/callback_canister_impl-opt.wasm local-bin/
ln -fs ../../../target/wasm32-unknown-unknown/release/group_index_canister_impl-opt.wasm local-bin/
ln -fs ../../../target/wasm32-unknown-unknown/release/notifications_canister_impl-opt.wasm local-bin/
ln -fs ../../../target/wasm32-unknown-unknown/release/online_users_aggregator_canister_impl-opt.wasm local-bin/
ln -fs ../../../target/wasm32-unknown-unknown/release/user_index_canister_impl-opt.wasm local-bin/

ln -fs ../../../target/wasm32-unknown-unknown/release/group_canister_impl-opt.wasm.xz local-bin/
ln -fs ../../../target/wasm32-unknown-unknown/release/user_canister_impl-opt.wasm.xz local-bin/

cp cycles_wallet.wasm local-bin/

## Update path; because we must run this script from the integration_tests directory, we know local-bin is in here.
PATH="$PWD/local-bin:$PATH"

if [ "$non_interactive" != true ]; then
    read -rp "Ready to test? Press ENTER..."
fi

## Run tests
st_test=$(date)
cargo run --bin integration_tests -- "$@"
e_test=$(date)

## Summary
echo "Testing times:"
echo "  + $st_test"
echo "  - $e_test"
