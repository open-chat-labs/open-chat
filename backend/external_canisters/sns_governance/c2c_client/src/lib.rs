use canister_client::{generate_candid_c2c_call, generate_candid_c2c_call_no_args};
use sns_governance_canister::*;

// Queries
generate_candid_c2c_call!(get_metadata);
generate_candid_c2c_call_no_args!(get_nervous_system_parameters);
generate_candid_c2c_call!(list_neurons);
generate_candid_c2c_call!(list_proposals);

// Updates
generate_candid_c2c_call!(manage_neuron);
