#!/bin/bash

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Instruct InfinitySwap's CHAT/ICP swap canister to 'burn' liquidity"
SUMMARY="This will remove the CHAT and ICP liquidity previously added by the OpenChat SNS, making it available to withdraw."
URL="https://app.infinityswap.one/pools/stats/vahkw-kaaaa-aaaal-acaza-cai"
ARGS="()"
FUNCTION_ID=100002

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
