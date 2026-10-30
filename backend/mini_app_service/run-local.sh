#!/bin/bash
# Runs the MiniApp service against the local replica and a local Redis, starting Redis if it isn't
# running. The service's keys are generated into .local the first time.
#
# Usage: ./backend/mini_app_service/run-local.sh [dfx identity, "default" if not given]
set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
IDENTITY=${1:-default}
LOCAL_DIR=$SCRIPT_DIR/.local
cd "$SCRIPT_DIR/../.."

mkdir -p "$LOCAL_DIR"
[ -f "$LOCAL_DIR/service_key.pem" ] || openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$LOCAL_DIR/service_key.pem"
[ -f "$LOCAL_DIR/ic_identity.pem" ] || openssl ecparam -name secp256k1 -genkey -noout -out "$LOCAL_DIR/ic_identity.pem"
redis-cli ping > /dev/null 2>&1 || redis-server --daemonize yes --dir "$LOCAL_DIR"

export IC_URL=http://127.0.0.1:${OC_REPLICA_PORT:-8080}
export IC_IDENTITY_PEM=$(cat "$LOCAL_DIR/ic_identity.pem")
export MINI_APP_SERVICE_KEY_PEM=$(cat "$LOCAL_DIR/service_key.pem")
export REDIS_URL=redis://127.0.0.1:6379
export USER_INDEX_CANISTER_ID=$(dfx canister id --identity "$IDENTITY" user_index)

cargo build -q -p mini_app_service
PRINCIPAL=$(./target/debug/mini_app_service principal)

# Only a platform operator can tell the UserIndex (and through it the LocalUserIndexes) which principal
# is the service, so that's done from the website's admin page (/admin), as on mainnet. Locally, dfx's
# identity is the governance principal, so it can make your user an operator first:
#   dfx canister call user_index add_platform_operator '(record { user_id = principal "<your user id>" })'
echo "MiniApp service principal: $PRINCIPAL (set it from /admin as a platform operator, if it isn't already)"

./target/debug/mini_app_service
