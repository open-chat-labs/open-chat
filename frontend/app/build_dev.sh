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
export LEDGER_CANISTER_HOTORNOT=6rdgd-kyaaa-aaaaq-aaavq-cai
export LEDGER_CANISTER_GHOST=4c4fd-caaaa-aaaaq-aaa3a-cai
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8080/{blobType}/
export FRAME_ANCESTORS=https://ht7v7-iaaaa-aaaak-qakga-cai.icp0.io,https://mdocx-gyaaa-aaaak-qcbsq-cai.icp0.io,https://calm-pasca-49d7be.netlify.app,http://localhost:5173,https://zexzi-jyaaa-aaaam-abj3q-cai.icp0.io,https://xw4dq-4yaaa-aaaam-abeuq-cai.ic0.app

npx rollup -c $WATCH
