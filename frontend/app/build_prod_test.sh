export BUILD_ENV=prod_test
export INTERNET_IDENTITY_CANISTER_ID=rdmx6-jaaaa-aaaaa-aaadq-cai
export INTERNET_IDENTITY_URL=https://identity.ic0.app
export NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChatTest
export VIDEO_BRIDGE_URL=https://d37cwaycp9g5li.cloudfront.net
export DFX_NETWORK=ic_test
export IC_URL=https://icp-api.io
export II_DERIVATION_ORIGIN=https://pfs7b-iqaaa-aaaaf-abs7q-cai.ic0.app
export CUSTOM_DOMAINS=test.oc.app
export BLOB_URL_PATTERN=https://{canisterId}.raw.icp0.io/{blobType}
export ACHIEVEMENT_URL_PATH=https://{canisterId}.raw.icp0.io
export WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5
export PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net

npx rollup -c
