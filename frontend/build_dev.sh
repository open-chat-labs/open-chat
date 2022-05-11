WATCH=$1

export INTERNET_IDENTITY_URL=http://localhost:8000?canisterId=rwlgt-iiaaa-aaaaa-aaaaa-cai
export DFX_NETWORK=local
export DEV_PORT=5001
export CLIENT_CACHING=true
export OPEN_STORAGE_INDEX_CANISTER=rdmx6-jaaaa-aaaaa-aaadq-cai
export LEDGER_CANISTER=qoctq-giaaa-aaaaa-aaaea-cai
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8000/{blobType}/

npx rollup -c $WATCH