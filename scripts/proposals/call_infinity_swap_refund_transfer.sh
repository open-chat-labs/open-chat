#!/bin/bash

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Instruct InfinitySwap's CHAT/ICP swap canister to refund CHAT and ICP"
SUMMARY="This will instruct InfinitySwap's canister to refund the CHAT and ICP previously deposited by the OpenChat SNS.

The transfers will go to the OpenChat SNS governance canister's default account for both ICP and CHAT, this means that the CHAT will be burned since this is the minting account.

That is not a problem though, since more CHAT can be minted in the future if decided by the DAO."
URL="https://app.infinityswap.one/pools/stats/vahkw-kaaaa-aaaal-acaza-cai"
ARGS="()"
FUNCTION_ID=100003

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
