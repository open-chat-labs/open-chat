WATCH=$1

# export INTERNET_IDENTITY_URL=http://localhost:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export INTERNET_IDENTITY_URL=http://127.0.0.1:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export NFID_URL=http://localhost:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export DFX_NETWORK=local
export DEV_PORT=5001
export LEDGER_CANISTER_ICP=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_SNS1=zfcdd-tqaaa-aaaaq-aaaga-cai
export LEDGER_CANISTER_BTC=mxzaz-hqaaa-aaaar-qaada-cai
export LEDGER_CANISTER_CHAT=2ouva-viaaa-aaaaq-aaamq-cai
export LEDGER_CANISTER_KINIC=73mez-iiaaa-aaaaq-aaasq-cai
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8080/{blobType}/

npx rollup -c $WATCH
