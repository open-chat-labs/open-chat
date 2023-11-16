use candid::{CandidType, Principal};
use ic_ledger_types::AccountIdentifier;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Empty {}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ManageNeuron {
    pub id: Option<NeuronId>,
    pub neuron_id_or_subaccount: Option<manage_neuron::NeuronIdOrSubaccount>,
    pub command: Option<manage_neuron::Command>,
}

pub mod manage_neuron {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct IncreaseDissolveDelay {
        pub additional_dissolve_delay_seconds: u32,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct StartDissolving {}

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct StopDissolving {}

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct AddHotKey {
        pub new_hot_key: Option<Principal>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct RemoveHotKey {
        pub hot_key_to_remove: Option<Principal>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct SetDissolveTimestamp {
        pub dissolve_timestamp_seconds: u64,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct JoinCommunityFund {}

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct LeaveCommunityFund {}

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct ChangeAutoStakeMaturity {
        pub requested_setting_for_auto_stake_maturity: bool,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Configure {
        pub operation: Option<configure::Operation>,
    }

    pub mod configure {
        use super::*;

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub enum Operation {
            IncreaseDissolveDelay(IncreaseDissolveDelay),
            StartDissolving(StartDissolving),
            StopDissolving(StopDissolving),
            AddHotKey(AddHotKey),
            RemoveHotKey(RemoveHotKey),
            SetDissolveTimestamp(SetDissolveTimestamp),
            JoinCommunityFund(JoinCommunityFund),
            LeaveCommunityFund(LeaveCommunityFund),
            ChangeAutoStakeMaturity(ChangeAutoStakeMaturity),
        }
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Disburse {
        pub amount: Option<disburse::Amount>,
        pub to_account: Option<AccountIdentifier>,
    }

    pub mod disburse {
        use super::*;

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub struct Amount {
            pub e8s: u64,
        }
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Split {
        pub amount_e8s: u64,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Merge {
        pub source_neuron_id: Option<NeuronId>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Spawn {
        pub new_controller: Option<Principal>,
        pub nonce: Option<u64>,
        pub percentage_to_spawn: Option<u32>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct MergeMaturity {
        pub percentage_to_merge: u32,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct StakeMaturity {
        pub percentage_to_stake: Option<u32>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct DisburseToNeuron {
        pub new_controller: Option<Principal>,
        pub amount_e8s: u64,
        pub dissolve_delay_seconds: u64,
        pub kyc_verified: bool,
        pub nonce: u64,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Follow {
        pub topic: i32,
        pub followees: Vec<NeuronId>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct RegisterVote {
        pub proposal: Option<ProposalId>,
        pub vote: i32,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct ClaimOrRefresh {
        pub by: Option<claim_or_refresh::By>,
    }

    pub mod claim_or_refresh {
        use super::*;

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub struct MemoAndController {
            pub memo: u64,
            pub controller: Option<Principal>,
        }

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub enum By {
            Memo(u64),
            MemoAndController(MemoAndController),
            NeuronIdOrSubaccount(Empty),
        }
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum NeuronIdOrSubaccount {
        Subaccount(Vec<u8>),
        NeuronId(NeuronId),
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum Command {
        Configure(Configure),
        Disburse(Disburse),
        Spawn(Spawn),
        Follow(Follow),
        RegisterVote(RegisterVote),
        Split(Split),
        DisburseToNeuron(DisburseToNeuron),
        ClaimOrRefresh(ClaimOrRefresh),
        MergeMaturity(MergeMaturity),
        Merge(Merge),
        StakeMaturity(StakeMaturity),
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ManageNeuronResponse {
    pub command: Option<manage_neuron_response::Command>,
}

pub mod manage_neuron_response {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct ClaimOrRefreshResponse {
        pub refreshed_neuron_id: Option<NeuronId>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum Command {
        Error(GovernanceError),
        Configure(Empty),
        Disburse(Empty),
        Spawn(Empty),
        Follow(Empty),
        MakeProposal(Empty),
        RegisterVote(Empty),
        Split(Empty),
        DisburseToNeuron(Empty),
        ClaimOrRefresh(ClaimOrRefreshResponse),
        MergeMaturity(Empty),
        Merge(Empty),
        StakeMaturity(Empty),
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GovernanceError {
    pub error_type: i32,
    pub error_message: String,
}

pub mod governance_error {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum ErrorType {
        Unspecified = 0,
        Ok = 1,
        Unavailable = 2,
        NotAuthorized = 3,
        NotFound = 4,
        InvalidCommand = 5,
        RequiresNotDissolving = 6,
        RequiresDissolving = 7,
        RequiresDissolved = 8,
        HotKey = 9,
        ResourceExhausted = 10,
        PreconditionFailed = 11,
        External = 12,
        LedgerUpdateOngoing = 13,
        InsufficientFunds = 14,
        InvalidPrincipal = 15,
        InvalidProposal = 16,
        AlreadyJoinedCommunityFund = 17,
        NotInTheCommunityFund = 18,
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NeuronId {
    pub id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalId {
    pub id: u64,
}
