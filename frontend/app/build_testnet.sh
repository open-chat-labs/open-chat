if [ -z "$DFX_NETWORK" ]
then
  echo 'DFX_NETWORK' not set
  exit 1
fi

export OC_DFX_NETWORK=$DFX_NETWORK
export OC_BUILD_ENV=testnet
export OC_NODE_ENV=$NODE_ENV
export OC_INTERNET_IDENTITY_CANISTER_ID=rdmx6-jaaaa-aaaaa-aaadq-cai
export OC_INTERNET_IDENTITY_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export OC_NFID_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export OC_IC_URL=https://$DFX_NETWORK.testnet.dfinity.network/
export OC_BLOB_URL_PATTERN=https://{canisterId}.raw.$DFX_NETWORK.testnet.dfinity.network/{blobType}
export OC_ACHIEVEMENT_URL_PATH=https://{canisterId}.raw.icp0.io
export OC_VIDEO_BRIDGE_URL=https://d37cwaycp9g5li.cloudfront.net
export OC_WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5
export OC_PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net
export OC_BITCOIN_MAINNET_ENABLED=false

npx rollup -c
