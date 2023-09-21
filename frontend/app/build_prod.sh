export BUILD_ENV=production
export INTERNET_IDENTITY_URL=https://identity.ic0.app
export NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChat
export DFX_NETWORK=ic
export IC_URL=https://icp-api.io
export II_DERIVATION_ORIGIN=https://6hsbt-vqaaa-aaaaf-aaafq-cai.ic0.app
export CUSTOM_DOMAINS=oc.app,webtest.oc.app
export BLOB_URL_PATTERN=https://{canisterId}.raw.icp0.io/{blobType}/
export FRAME_ANCESTORS=https://ht7v7-iaaaa-aaaak-qakga-cai,https://mdocx-gyaaa-aaaak-qcbsq-cai,https://calm-pasca-49d7be.netlify.app,http://localhost:5173,https://zexzi-jyaaa-aaaam-abj3q-cai.icp0.io,https://xw4dq-4yaaa-aaaam-abeuq-cai.ic0.app

npx rollup -c
