RECIPIENT=$1
IDENTITY=${2:-default}
AMOUNT=${3:-100000000000}

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

dfx --identity $IDENTITY canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer "(record {
    to = record { owner = principal \"$RECIPIENT\" };
    amount = $AMOUNT:nat;
})"