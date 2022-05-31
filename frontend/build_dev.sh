WATCH=$1

export INTERNET_IDENTITY_URL=http://localhost:8000?canisterId=rwlgt-iiaaa-aaaaa-aaaaa-cai
export DFX_NETWORK=local
export DEV_PORT=5001
export CLIENT_CACHING=true
export OPEN_STORAGE_INDEX_CANISTER=qjdve-lqaaa-aaaaa-aaaeq-cai
export LEDGER_CANISTER_ICP=qoctq-giaaa-aaaaa-aaaea-cai
export LEDGER_CANISTER_BTC=qoctq-giaaa-aaaaa-aaaea-cai
export LEDGER_CANISTER_CHAT=qoctq-giaaa-aaaaa-aaaea-cai
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8000/{blobType}/
export ENABLE_MULTI_CRYPTO=true
export ENABLE_FORWARDING=true

npx rollup -c $WATCH