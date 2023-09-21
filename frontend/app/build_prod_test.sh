export BUILD_ENV=prod_test
export INTERNET_IDENTITY_URL=https://identity.ic0.app
export NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChatTest
export DFX_NETWORK=ic_test
export IC_URL=https://icp-api.io
export II_DERIVATION_ORIGIN=https://pfs7b-iqaaa-aaaaf-abs7q-cai.ic0.app
export CUSTOM_DOMAINS=test.oc.app
export BLOB_URL_PATTERN=https://{canisterId}.raw.icp0.io/{blobType}/

npx rollup -c
