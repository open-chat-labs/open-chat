WATCH=$1

export INTERNET_IDENTITY_URL=http://localhost:8080?canisterId=qaa6y-5yaaa-aaaaa-aaafa-cai
export NFID_URL=http://localhost:8080?canisterId=qaa6y-5yaaa-aaaaa-aaafa-cai
export DFX_NETWORK=local
export DEV_PORT=5001
export CLIENT_CACHING=true
export OPEN_STORAGE_INDEX_CANISTER=si2b5-pyaaa-aaaaa-aaaja-cai
export LEDGER_CANISTER_ICP=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_BTC=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_CHAT=ryjl3-tyaaa-aaaaa-aaaba-cai
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8080/{blobType}/
export ENABLE_MULTI_CRYPTO=true

npx rollup -c $WATCH
