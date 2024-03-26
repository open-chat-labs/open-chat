use canister_api_macros::proposal_validation;
use proposal_validation_canister::*;

proposal_validation!(nns_governance, manage_neuron, false);
