use canister_client::generate_c2c_call;
use registry_canister::*;

// Queries
generate_c2c_call!(c2c_nervous_systems);

// Updates
generate_c2c_call!(c2c_set_submitting_proposals_enabled);
