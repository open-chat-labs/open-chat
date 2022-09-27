#! /usr/bin/env bash

# Originally copied from https://github.com/dfinity/ic/blob/2d1a8336bc853eb500b2a12b8dd0527de8446969/rs/tests/setup-and-cargo-test.sh

set -eu

if [[ ${TMPDIR-/tmp} == /run/* ]]; then
    echo "Running in nix-shell on Linux, unsetting TMPDIR"
    export TMPDIR=
fi

show_help() {
    echo "Usage: ./run.sh [OPTIONS] [-- FONDUE_OPTIONS]"
    echo ""
    echo "Compiles replica, orchestrator, rosetta and sandbox binaries, sets the binaries up then"
    echo "runs the tests"
    echo ""
    echo "This script must be run from 'backend/integration_tests'. "
    echo ""
    echo "For information on the fondue options run this script with '-- -h'."
    echo ""
    echo "Options:"
    echo "   --no-build    Do not build any new binaries"
    echo ""
    echo "   --debug       Build the binaries in debug mode (ignored if --no-build is specified)"
    echo ""
    echo "   --jobs NUM    Passes '--jobs NUM' to all cargo build commands issued by this script."
    echo ""
    echo "   --no-cleanup  Do not delete temp. directories (./.tmp*)."
    echo ""
}

cleanup=true
no_build=false
debug=false
jobs_str=""

while [[ $# -ge 1 ]]; do
    case $1 in
        --no-build)
            no_build=true
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
        --no-cleanup)
            cleanup=false
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

currdir=$(basename "$PWD")
if [[ "$currdir" != "integration_tests" ]]; then
    echo "You must run this from the integration_tests directory."
    exit 1
fi

# Call cleanup() when the user presses Ctrl+C
trap "on_sigterm" 2

remove_tmp_dirs() {
    if [[ "$cleanup" == true ]]; then
        echo "Removing any temporary directories (./.tmp* and ./ic_config*)!"
        rm -rf ./.tmp*
        rm -rf ./ic_config*
    fi
}

# The shell kills the process group. However, the orchestrator sets the pgid to
# its own pid. As a result, the orchestrators and the replicas started by this
# script will not get killed when the user presses Ctrl+C. As a mitigation, ...
# we simply kill all orchestrator and system-tests.
on_sigterm() {
    echo "Received SIGINT ..."
    echo "Sending SIGTERM to 'orchestrator' processes started by this session!"
    for pid in $(pgrep orchestrator); do kill -s SIGTERM "$pid"; done
    echo "Sending SIGTERM to 'system-tests' processes started by this session!"
    for pid in $(pgrep system-tests); do kill -s SIGTERM "$pid"; done
    echo "Sending SIGTERM to 'ic-rosetta-api' processes started by this session!"
    for pid in $(pgrep ic-rosetta-api); do kill -s SIGTERM "$pid"; done
    # I don't think these are necessary, but just in case...
    echo "Sending SIGTERM to 'rosetta-cli' processes started by this session!"
    for pid in $(pgrep rosetta-cli); do kill -s SIGTERM "$pid"; done
    echo "Sending SIGTERM to 'canister_sandbox' processes started by this session!"
    for pid in $(pgrep canister_sandbox); do kill -s SIGTERM "$pid"; done
    echo "Sending SIGTERM to 'sandbox_launcher' processes started by this session!"
    for pid in $(pgrep sandbox_launcher); do kill -s SIGTERM "$pid"; done
    echo "You can remove rosetta_workspace/rosetta_api_tmp_* dirs after you confirmed rosetta_api finished"
    remove_tmp_dirs
}

## Determine where the target lives
case $(uname) in
    Darwin) RUST_TRIPLE=x86_64-apple-darwin ;;
    Linux) RUST_TRIPLE=x86_64-unknown-linux-gnu ;;
esac

if [[ "$no_build" != true ]]; then
    st_build=$(date)

    ## Build the canister wasms
    pushd ../../scripts
    ./generate-wasm.sh callback_canister_impl
    ./generate-wasm.sh group_canister_impl
    ./generate-wasm.sh group_index_canister_impl
    ./generate-wasm.sh notifications_canister_impl
    ./generate-wasm.sh online_users_aggregator_canister_impl
    ./generate-wasm.sh proposals_bot_canister_impl
    ./generate-wasm.sh user_canister_impl
    ./generate-wasm.sh user_index_canister_impl
    popd

    e_build=$(date)

    echo "Building times:"
    echo "  + $st_build"
    echo "  - $e_build"
fi

## Sets target to the BUILD_DIR subdir of $CARGO_TARGET_DIR if this variable is set.
## If CARGO_TEST_DIR is not set, we use the default $(pwd)/../target instead.
icBinDir=$(pwd)/icBinaries

if [[ ! -f "${icBinDir}/replica" ]] || [[ ! -f "${icBinDir}/orchestrator" ]] \
    || [[ ! -f "${icBinDir}/ic-rosetta-api" ]] \
    || [[ ! -f "${icBinDir}/canister_sandbox" ]] \
    || [[ ! -f "${icBinDir}/sandbox_launcher" ]]; then
    echo "Make sure that the following files exist:"
    echo "    - ${icBinDir}/replica"
    echo "    - ${icBinDir}/orchestrator"
    echo "    - ${icBinDir}/ic-rosetta-api"
    echo "    - ${icBinDir}/canister_sandbox"
    echo "    - ${icBinDir}/sandbox_launcher"
    exit 1

    ## You can download them from here -
    ## macOS: https://download.dfinity.systems/ic/068c59b85ea4a384469b113f87e6b52b94c11d6b/nix-release/x86_64-darwin/{filename}.gz
    ## linux:
fi

## Make a local-bin directory and link the replica and orchestrator here
mkdir -p local-bin
ln -fs "${icBinDir}/replica" local-bin/
ln -fs "${icBinDir}/orchestrator" local-bin/
ln -fs "${icBinDir}/ic-rosetta-api" local-bin/
ln -fs "${icBinDir}/canister_sandbox" local-bin/
ln -fs "${icBinDir}/sandbox_launcher" local-bin/

ln -fs ../../../wasms/callback_canister_impl.wasm.gz local-bin/
ln -fs ../../../wasms/group_canister_impl.wasm.gz local-bin/
ln -fs ../../../wasms/group_index_canister_impl.wasm.gz local-bin/
ln -fs ../../../wasms/notifications_canister_impl.wasm.gz local-bin/
ln -fs ../../../wasms/online_users_aggregator_canister_impl.wasm.gz local-bin/
ln -fs ../../../wasms/proposals_bot_canister_impl.wasm.gz local-bin/
ln -fs ../../../wasms/user_canister_impl.wasm.gz local-bin/
ln -fs ../../../wasms/user_index_canister_impl.wasm.gz local-bin/

## Update path; because we must run this script from the integration_tests directory, we know local-bin is in here.
PATH="$PWD/local-bin:$PATH"

## Run tests
st_test=$(date)
cargo run --bin integration_tests -- "$@"
e_test=$(date)

## Summary
echo "Testing times:"
echo "  + $st_test"
echo "  - $e_test"
