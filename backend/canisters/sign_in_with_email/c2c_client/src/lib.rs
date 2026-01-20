use canister_client::generate_candid_c2c_call;
use sign_in_with_email_canister::*;

// Queries
generate_candid_c2c_call!(get_principal);
