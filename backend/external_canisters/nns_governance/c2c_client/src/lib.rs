use canister_client::generate_candid_c2c_call;
use nns_governance_canister::*;

// Queries
generate_candid_c2c_call!(list_neurons);
generate_candid_c2c_call!(list_proposals);

// Updates
generate_candid_c2c_call!(get_ballots, list_proposals);
generate_candid_c2c_call!(manage_neuron);
generate_candid_c2c_call!(register_vote, manage_neuron);

pub mod get_ballots {
    use nns_governance_canister::types::{ListProposalInfo, ListProposalInfoBallotsOnlyResponse};

    pub type Args = ListProposalInfo;
    pub type Response = ListProposalInfoBallotsOnlyResponse;
}

pub mod register_vote {
    use nns_governance_canister::types::{ManageNeuronRegisterVoteOnly, ManageNeuronResponseRegisterVoteOnly};

    pub type Args = ManageNeuronRegisterVoteOnly;
    pub type Response = ManageNeuronResponseRegisterVoteOnly;
}
