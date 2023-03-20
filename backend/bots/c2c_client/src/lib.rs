use bot_api::*;
use canister_client::generate_c2c_call;

// Queries

// Updates
generate_c2c_call!(handle_direct_message);
