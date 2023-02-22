#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

COMMIT_ID=$1

if [ -z "$COMMIT_ID" ]
then
  COMMIT_ID=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
fi

echo "Downloading wasms for commit $COMMIT_ID"

rm -rf wasms
mkdir wasms
cd wasms

curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/group_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/group_index_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/local_group_index_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/local_user_index_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/notifications_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/notifications_index_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/online_users_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/proposals_bot_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/storage_bucket_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/storage_index_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/user_canister_impl.wasm.gz
curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/user_index_canister_impl.wasm.gz

echo "Wasms downloaded"