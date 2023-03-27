#!/bin/sh

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Instruct InfinitySwap's CHAT/ICP swap canister to 'mint' new liquidity"
SUMMARY="The OpenChat SNS has transferred 15,000 ICP and 250,000 CHAT to InfinitySwap's CHAT/ICP swap canister as a result of these 2 proposals, [ICP](https://dashboard.internetcomputer.org/sns/3e3x2-xyaaa-aaaaq-aaalq-cai/proposal/76) [CHAT](https://dashboard.internetcomputer.org/sns/3e3x2-xyaaa-aaaaq-aaalq-cai/proposal/77).

The OpenChat SNS must now call \`mint\` on the swap canister instructing it to 'mint' the tokens into new liquidity."

URL="https://dashboard.internetcomputer.org/sns/3e3x2-xyaaa-aaaaq-aaalq-cai/proposal/72"
ARGS="()"
FUNCTION_ID=100001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
