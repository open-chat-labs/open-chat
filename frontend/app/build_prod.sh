if [ -z "$OC_WEBSITE_VERSION" ]
then
  echo 'OC_WEBSITE_VERSION' not set
  exit 1
fi

export OC_BUILD_ENV=production
export OC_NODE_ENV=$NODE_ENV
export OC_INTERNET_IDENTITY_CANISTER_ID=rdmx6-jaaaa-aaaaa-aaadq-cai
export OC_INTERNET_IDENTITY_URL=https://identity.ic0.app
export OC_NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChat
export OC_DFX_NETWORK=ic
export OC_VIDEO_BRIDGE_URL=https://d7ufu5rwdb6eb.cloudfront.net
export OC_IC_URL=https://icp-api.io
export OC_II_DERIVATION_ORIGIN=https://6hsbt-vqaaa-aaaaf-aaafq-cai.ic0.app
export OC_CUSTOM_DOMAINS=oc.app,webtest.oc.app
export OC_BLOB_URL_PATTERN=https://{canisterId}.raw.icp0.io/{blobType}
export OC_ACHIEVEMENT_URL_PATH=https://{canisterId}.raw.icp0.io
export OC_WALLET_CONNECT_PROJECT_ID=adf8b4a7c5514a8229981aabdee2e246
export OC_PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net

npx rollup -c
