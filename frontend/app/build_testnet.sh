if [ -z "$DFX_NETWORK" ]
then
  echo 'DFX_NETWORK' not set
  exit 1
fi

export BUILD_ENV=testnet
export INTERNET_IDENTITY_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export NFID_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export IC_URL=https://$DFX_NETWORK.testnet.dfinity.network/
export BLOB_URL_PATTERN=https://{canisterId}.raw.$DFX_NETWORK.testnet.dfinity.network/{blobType}
export VIDEO_BRIDGE_URL=https://d37cwaycp9g5li.cloudfront.net
export WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5

npx rollup -c
