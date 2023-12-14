use canister_client::generate_c2c_call;
use escrow_canister::*;

// Queries

// Updates
generate_c2c_call!(create_offer);
generate_c2c_call!(cancel_offer);
generate_c2c_call!(notify_deposit);
