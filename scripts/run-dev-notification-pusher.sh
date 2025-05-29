DFX_IDENTITY=${1:-default}

export NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister id notifications_index)
export NOTIFICATIONS_CANISTER_ID=$(dfx canister id local_user_index)
export IC_URL="http://127.0.0.1:8080"
export IC_IDENTITY_PEM=$(dfx identity export $DFX_IDENTITY)
export VAPID_PRIVATE_PEM="-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIJdV6F+ZBM6sf74RwIrx8SmT7EjRhRfdYPpLN/6Az99EoAoGCCqGSM49
AwEHoUQDQgAE7M8gHSA3XRsUiMyzXSOvHNY2VmtWdmaukrZIsQN3e4BCLRgdD+fz
PH/bMYMukTdUe8iN6WzgEUiqIVaa+8AbPg==
-----END EC PRIVATE KEY-----"
export IS_PRODUCTION="false"

cargo run -p notification_pusher_cli