use canister_client::generate_candid_update_call;
use online_users_canister::*;

// Updates
generate_candid_update_call!(mark_as_online);
