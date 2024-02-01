use canister_client::{generate_candid_c2c_call, generate_candid_c2c_call_no_args};
use cycles_minting_canister::*;

// Queries
generate_candid_c2c_call_no_args!(neuron_maturity_modulation);

// Updates
generate_candid_c2c_call!(notify_top_up);
