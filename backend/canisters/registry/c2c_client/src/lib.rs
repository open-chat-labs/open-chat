use canister_client::generate_c2c_call;
use registry_canister::*;

// Queries
generate_c2c_call!(c2c_nervous_systems);
generate_c2c_call!(c2c_tokens);

// Updates
generate_c2c_call!(c2c_set_submitting_proposals_enabled);
