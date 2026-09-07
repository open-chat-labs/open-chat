set -euo pipefail

export NODE_ENV=production

# Pull in .env as defaults. Values explicitly exported by the outer Tauri/CI invocation win.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
source "$SCRIPT_DIR/source_env_defaults.sh"
source_env_defaults "$ENV_FILE"

export OC_APP_TYPE=android
export OC_MOBILE_LAYOUT=v2
# Sideload builds must remain on the frontend bundled into the APK. In particular, do not inherit
# OC_OTA_UPDATES from the shell that happened to launch the build: an install-over preserves the
# native OTA cache and could otherwise replace this test UI before its first render. Official
# store/CI builds can opt in explicitly with OC_ANDROID_OTA_UPDATES=patch|minor|major.
case "${OC_ANDROID_OTA_UPDATES:-none}" in
    none|patch|minor|major)
        export OC_OTA_UPDATES="${OC_ANDROID_OTA_UPDATES:-none}"
        ;;
    *)
        echo "Invalid OC_ANDROID_OTA_UPDATES: expected none, patch, minor, or major" >&2
        exit 1
        ;;
esac
if [ -z "${OC_BLOB_URL_PATTERN:-}" ]; then
    export OC_BLOB_URL_PATTERN='https://{canisterId}.raw.icp0.io/{blobType}'
fi
export OC_NODE_ENV="${OC_NODE_ENV:-$NODE_ENV}"
export OC_BUILD_ENV="${OC_BUILD_ENV:-$NODE_ENV}"
export OC_WEBAUTHN_ORIGIN="${OC_WEBAUTHN_ORIGIN:-oc.app}"

export OC_BITCOIN_MAINNET_ENABLED="${OC_BITCOIN_MAINNET_ENABLED:-true}"
export OC_IC_URL="${OC_IC_URL:-https://icp-api.io}"
export OC_DFX_NETWORK="${OC_DFX_NETWORK:-ic}"
export OC_ACCOUNT_LINKING_CODES_ENABLED="${OC_ACCOUNT_LINKING_CODES_ENABLED:-false}"
export OC_ALCHEMY_API_KEY="${OC_ALCHEMY_API_KEY:-6pSBD1eOqwyGDI1xFfV-p}"

export OC_INTERNET_IDENTITY_CANISTER_ID="${OC_INTERNET_IDENTITY_CANISTER_ID:-rdmx6-jaaaa-aaaaa-aaadq-cai}"
export OC_INTERNET_IDENTITY_URL="${OC_INTERNET_IDENTITY_URL:-https://identity.internetcomputer.org}"
export OC_NFID_URL="${OC_NFID_URL:-https://nfid.one/authenticate/?applicationName=OpenChat}"
export OC_PREVIEW_PROXY_URL="${OC_PREVIEW_PROXY_URL:-https://dy7sqxe9if6te.cloudfront.net}"
export OC_VAPID_PUBLIC_KEY="${OC_VAPID_PUBLIC_KEY:-BD8RU5tDBbFTDFybDoWhFzlL5+mYptojI6qqqqiit68KSt17+vt33jcqLTHKhAXdSzu6pXntfT9e4LccBv+iV3A=}"
export OC_VIDEO_BRIDGE_URL="${OC_VIDEO_BRIDGE_URL:-https://d7ufu5rwdb6eb.cloudfront.net}"
export OC_NCA_REPORTER_URL="${OC_NCA_REPORTER_URL:-https://d368tfz0uea1ks.cloudfront.net}"
export OC_WALLET_CONNECT_PROJECT_ID="${OC_WALLET_CONNECT_PROJECT_ID:-adf8b4a7c5514a8229981aabdee2e246}"

# override klipy api key from local environment (app only)
export OC_KLIPY_APIKEY="${OC_APP_KLIPY_APIKEY:-}"

export OC_II_DERIVATION_ORIGIN="${OC_II_DERIVATION_ORIGIN:-https://6hsbt-vqaaa-aaaaf-aaafq-cai.ic0.app}"
# export OC_CUSTOM_DOMAINS=oc.app,webtest.oc.app
if [ -z "${OC_CANISTER_URL_PATH:-}" ]; then
    export OC_CANISTER_URL_PATH='https://{canisterId}.raw.icp0.io'
fi
export OC_WEBSITE_VERSION="${OC_WEBSITE_VERSION:-2.0.0-mobile-rc32}"

# Use environment variables if provided (e.g. from CI secrets or .env), otherwise fall back to dummy values
export OC_ROLLBAR_ACCESS_TOKEN="${OC_ROLLBAR_ACCESS_TOKEN:-this-is-a-fake-token}"
export OC_USERGEEK_APIKEY="${OC_USERGEEK_APIKEY:-this-is-a-fake-apikey}"
export OC_METERED_APIKEY="${OC_METERED_APIKEY:-this-is-a-fake-apikey}"
# Canister IDs are supplied by the caller or filled from the selected network's canister_ids.json
# by initEnv. Do not seed placeholders here: they would be indistinguishable from explicit caller
# overrides and could mask the selected network's real IDs.
export OC_BASE_ORIGIN="${OC_BASE_ORIGIN:-https://oc.app}"

echo "DEBUG: OC_APP_STORE is set to: '${OC_APP_STORE:-}'"

npx rollup -c

cp -r ./public/* ./build

for required_asset in build/index.html build/version build/ota-policy.json build/android-rp-id; do
    if [ ! -s "$required_asset" ]; then
        echo "Android frontend build is incomplete: missing $required_asset" >&2
        exit 1
    fi
done
