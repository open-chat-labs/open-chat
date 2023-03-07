export INTERNET_IDENTITY_URL=https://identity.ic0.app
export NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChatTest
export II_DERIVATION_ORIGIN=https://pfs7b-iqaaa-aaaaf-abs7q-cai.ic0.app
export II_ALTERNATIVE_ORIGINS=https://test.oc.app

npm i
npx rollup -c
