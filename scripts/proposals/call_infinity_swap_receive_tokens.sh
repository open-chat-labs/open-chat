#!/bin/sh

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Notify InfinitySwap's CHAT/ICP swap canister of a CHAT transfer"
SUMMARY="250,000 CHAT has been transferred to InfinitySwap's CHAT/ICP swap canister as a result of [this proposal](https://dashboard.internetcomputer.org/sns/3e3x2-xyaaa-aaaaq-aaalq-cai/proposal/77).

The OpenChat SNS must now call \`receive_tokens\` on the swap canister to notify it of this transfer."

URL="https://dashboard.internetcomputer.org/sns/3e3x2-xyaaa-aaaaq-aaalq-cai/proposal/72"
ARGS="(principal \"2ouva-viaaa-aaaaq-aaamq-cai\")"
FUNCTION_ID=100000

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
