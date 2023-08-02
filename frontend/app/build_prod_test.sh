export INTERNET_IDENTITY_URL=https://identity.ic0.app
export NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChatTest
export DFX_NETWORK=ic_test
export DEV_PORT=5001
export IC_URL=https://icp-api.io
export II_DERIVATION_ORIGIN=https://pfs7b-iqaaa-aaaaf-abs7q-cai.ic0.app
export CUSTOM_DOMAINS=test.oc.app
export LEDGER_CANISTER_ICP=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_SNS1=zfcdd-tqaaa-aaaaq-aaaga-cai
export LEDGER_CANISTER_BTC=mxzaz-hqaaa-aaaar-qaada-cai
export LEDGER_CANISTER_CHAT=2ouva-viaaa-aaaaq-aaamq-cai
export LEDGER_CANISTER_KINIC=73mez-iiaaa-aaaaq-aaasq-cai
export LEDGER_CANISTER_HOTORNOT=6rdgd-kyaaa-aaaaq-aaavq-cai
export LEDGER_CANISTER_GHOST=4c4fd-caaaa-aaaaq-aaa3a-cai
export BLOB_URL_PATTERN=https://{canisterId}.raw.icp0.io/{blobType}/

npx rollup -c
