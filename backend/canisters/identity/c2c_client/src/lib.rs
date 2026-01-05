use canister_client::generate_c2c_call;
use identity_canister::*;

// Queries

// Updates
generate_c2c_call!(c2c_set_oc_secret_key);
generate_c2c_call!(c2c_set_user_identities);
