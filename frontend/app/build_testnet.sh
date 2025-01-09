if [ -z "$DFX_NETWORK" ]
then
  echo 'DFX_NETWORK' not set
  exit 1
fi

export BUILD_ENV=testnet
export INTERNET_IDENTITY_CANISTER_ID=rdmx6-jaaaa-aaaaa-aaadq-cai
export INTERNET_IDENTITY_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export NFID_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export IC_URL=https://$DFX_NETWORK.testnet.dfinity.network/
export BLOB_URL_PATTERN=https://{canisterId}.raw.$DFX_NETWORK.testnet.dfinity.network/{blobType}
export ACHIEVEMENT_URL_PATH=https://{canisterId}.raw.icp0.io
export VIDEO_BRIDGE_URL=https://d37cwaycp9g5li.cloudfront.net
export WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5
export PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net

npx rollup -c
