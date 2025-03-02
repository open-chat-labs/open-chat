export OC_BUILD_ENV=prod_test
export OC_NODE_ENV=$NODE_ENV
export OC_WEBAUTHN_ORIGIN=test.oc.app
export OC_INTERNET_IDENTITY_CANISTER_ID=rdmx6-jaaaa-aaaaa-aaadq-cai
export OC_INTERNET_IDENTITY_URL=https://identity.internetcomputer.org
export OC_NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChatTest
export OC_VIDEO_BRIDGE_URL=https://d37cwaycp9g5li.cloudfront.net
export OC_DFX_NETWORK=ic_test
export OC_IC_URL=https://icp-api.io
export OC_II_DERIVATION_ORIGIN=https://pfs7b-iqaaa-aaaaf-abs7q-cai.ic0.app
export OC_CUSTOM_DOMAINS=test.oc.app
export OC_BLOB_URL_PATTERN=https://{canisterId}.raw.icp0.io/{blobType}
export OC_ACHIEVEMENT_URL_PATH=https://{canisterId}.raw.icp0.io
export OC_WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5
export OC_PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net

npx rollup -c
