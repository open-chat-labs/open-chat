use canister_client::generate_c2c_call;
use escrow_canister::*;

// Queries

// Updates
generate_c2c_call!(c2c_set_token_enabled);
generate_c2c_call!(create_swap);
generate_c2c_call!(cancel_swap);
generate_c2c_call!(notify_deposit);
