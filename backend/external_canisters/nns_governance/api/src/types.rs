use candid::{CandidType, Principal};
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use types::{Empty, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BallotInfo {
    pub proposal_id: Option<ProposalId>,
    pub vote: i32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Neuron {
    pub id: Option<NeuronId>,
    pub account: Vec<u8>,
    pub controller: Option<Principal>,
    pub hot_keys: Vec<Principal>,
    pub cached_neuron_stake_e8s: u64,
    pub neuron_fees_e8s: u64,
    pub created_timestamp_seconds: u64,
    pub aging_since_timestamp_seconds: u64,
    pub spawn_at_timestamp_seconds: Option<u64>,
    pub followees: HashMap<i32, neuron::Followees>,
    pub recent_ballots: Vec<BallotInfo>,
    pub kyc_verified: bool,
    pub maturity_e8s_equivalent: u64,
    pub staked_maturity_e8s_equivalent: Option<u64>,
    pub auto_stake_maturity: Option<bool>,
    pub not_for_profit: bool,
    pub joined_community_fund_timestamp_seconds: Option<u64>,
    pub known_neuron_data: Option<KnownNeuronData>,
    pub voting_power_refreshed_timestamp_seconds: Option<u64>,
    pub dissolve_state: Option<neuron::DissolveState>,
}

impl Neuron {
    pub fn is_dissolved(&self, now: TimestampMillis) -> bool {
        match self.dissolve_state {
            Some(neuron::DissolveState::WhenDissolvedTimestampSeconds(ts)) => ts * 1000 < now,
            None => true,
            _ => false,
        }
    }
}

pub mod neuron {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Followees {
        pub followees: Vec<NeuronId>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum DissolveState {
        WhenDissolvedTimestampSeconds(u64),
        DissolveDelaySeconds(u64),
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ManageNeuron {
    pub id: Option<NeuronId>,
    pub neuron_id_or_subaccount: Option<manage_neuron::NeuronIdOrSubaccount>,
    pub command: Option<manage_neuron::Command>,
}

impl ManageNeuron {
    pub fn new(neuron_id: u64, command: manage_neuron::Command) -> ManageNeuron {
        ManageNeuron {
            id: Some(NeuronId { id: neuron_id }),
            neuron_id_or_subaccount: None,
            command: Some(command),
        }
    }
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

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
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
        RefreshVotingPower(Empty),
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
        RefreshVotingPower(Empty),
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct KnownNeuronData {
    pub name: String,
    pub description: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ListNeurons {
    pub neuron_ids: Vec<u64>,
    pub include_neurons_readable_by_caller: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ListNeuronsResponse {
    pub full_neurons: Vec<Neuron>,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct ListProposalInfo {
    pub limit: u32,
    pub before_proposal: Option<ProposalId>,
    pub exclude_topic: Vec<i32>,
    pub include_reward_status: Vec<i32>,
    pub include_status: Vec<i32>,
    pub include_all_manage_neuron_proposals: Option<bool>,
    pub omit_large_fields: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ListProposalInfoResponse {
    pub proposal_info: Vec<ProposalInfo>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalInfo {
    pub id: Option<ProposalId>,
    pub proposer: Option<NeuronId>,
    pub reject_cost_e8s: u64,
    pub proposal: Option<Proposal>,
    pub proposal_timestamp_seconds: u64,
    pub ballots: HashMap<u64, Ballot>,
    pub latest_tally: Option<Tally>,
    pub decided_timestamp_seconds: u64,
    pub executed_timestamp_seconds: u64,
    pub failed_timestamp_seconds: u64,
    pub failure_reason: Option<GovernanceError>,
    pub reward_event_round: u64,
    pub topic: i32,
    pub status: i32,
    pub reward_status: i32,
    pub deadline_timestamp_seconds: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Proposal {
    pub title: Option<String>,
    pub summary: String,
    pub url: String,
    #[serde(deserialize_with = "ok_or_default")]
    pub action: Option<proposal::Action>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Ballot {
    pub vote: i32,
    pub voting_power: u64,
}

fn ok_or_default<'de, T, D>(deserializer: D) -> Result<T, D::Error>
where
    T: Deserialize<'de> + Default,
    D: Deserializer<'de>,
{
    Ok(T::deserialize(deserializer).unwrap_or_default())
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Tally {
    pub timestamp_seconds: u64,
    pub yes: u64,
    pub no: u64,
    pub total: u64,
}

pub mod proposal {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum Action {
        ManageNeuron(Box<ManageNeuron>),
        ManageNetworkEconomics(NetworkEconomics),
        Motion(Motion),
        ExecuteNnsFunction(ExecuteNnsFunction),
        ApproveGenesisKyc(ApproveGenesisKyc),
        AddOrRemoveNodeProvider(AddOrRemoveNodeProvider),
        RewardNodeProvider(RewardNodeProvider),
        SetDefaultFollowees(SetDefaultFollowees),
        RewardNodeProviders(RewardNodeProviders),
        RegisterKnownNeuron(KnownNeuron),
        CreateServiceNervousSystem(Box<CreateServiceNervousSystem>),
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NetworkEconomics {
    pub reject_cost_e8s: u64,
    pub neuron_minimum_stake_e8s: u64,
    pub neuron_management_fee_per_proposal_e8s: u64,
    pub minimum_icp_xdr_rate: u64,
    pub neuron_spawn_dissolve_delay_seconds: u64,
    pub maximum_node_provider_rewards_e8s: u64,
    pub transaction_fee_e8s: u64,
    pub max_proposals_to_keep_per_topic: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Motion {
    pub motion_text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ExecuteNnsFunction {
    pub nns_function: i32,
    pub payload: Vec<u8>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AddOrRemoveNodeProvider {
    pub change: Option<add_or_remove_node_provider::Change>,
}

pub mod add_or_remove_node_provider {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum Change {
        ToAdd(NodeProvider),
        ToRemove(NodeProvider),
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NodeProvider {
    pub id: Option<Principal>,
    pub reward_account: Option<AccountIdentifier>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RewardNodeProvider {
    pub node_provider: Option<NodeProvider>,
    pub amount_e8s: u64,
    pub reward_mode: Option<reward_node_provider::RewardMode>,
}

pub mod reward_node_provider {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct RewardToNeuron {
        pub dissolve_delay_seconds: u64,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct RewardToAccount {
        pub to_account: Option<AccountIdentifier>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum RewardMode {
        RewardToNeuron(RewardToNeuron),
        RewardToAccount(RewardToAccount),
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RewardNodeProviders {
    pub rewards: Vec<RewardNodeProvider>,
    pub use_registry_derived_rewards: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SetDefaultFollowees {
    pub default_followees: HashMap<i32, neuron::Followees>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct KnownNeuron {
    pub id: Option<NeuronId>,
    pub known_neuron_data: Option<KnownNeuronData>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ApproveGenesisKyc {
    pub principals: Vec<Principal>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CreateServiceNervousSystem {
    pub name: Option<String>,
    pub description: Option<String>,
    pub url: Option<String>,
    pub logo: Option<Image>,
    pub fallback_controller_principal_ids: Vec<Principal>,
    pub dapp_canisters: Vec<Canister>,
    pub initial_token_distribution: Option<create_service_nervous_system::InitialTokenDistribution>,
    pub swap_parameters: Option<create_service_nervous_system::SwapParameters>,
    pub ledger_parameters: Option<create_service_nervous_system::LedgerParameters>,
    pub governance_parameters: Option<create_service_nervous_system::GovernanceParameters>,
}

pub mod create_service_nervous_system {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct InitialTokenDistribution {
        pub developer_distribution: Option<initial_token_distribution::DeveloperDistribution>,
        pub treasury_distribution: Option<initial_token_distribution::TreasuryDistribution>,
        pub swap_distribution: Option<initial_token_distribution::SwapDistribution>,
    }

    pub mod initial_token_distribution {
        use super::*;

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub struct DeveloperDistribution {
            pub developer_neurons: Vec<developer_distribution::NeuronDistribution>,
        }

        pub mod developer_distribution {
            use super::*;

            #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
            pub struct NeuronDistribution {
                pub controller: Option<Principal>,
                pub dissolve_delay: Option<Duration>,
                pub memo: Option<u64>,
                pub stake: Option<Tokens>,
                pub vesting_period: Option<Duration>,
            }
        }

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub struct TreasuryDistribution {
            pub total: Option<Tokens>,
        }

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub struct SwapDistribution {
            pub total: Option<Tokens>,
        }
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct SwapParameters {
        pub minimum_participants: Option<u64>,
        pub minimum_icp: Option<Tokens>,
        pub maximum_icp: Option<Tokens>,
        pub minimum_direct_participation_icp: Option<Tokens>,
        pub maximum_direct_participation_icp: Option<Tokens>,
        pub minimum_participant_icp: Option<Tokens>,
        pub maximum_participant_icp: Option<Tokens>,
        pub neuron_basket_construction_parameters: Option<swap_parameters::NeuronBasketConstructionParameters>,
        pub confirmation_text: Option<String>,
        pub restricted_countries: Option<Countries>,
        pub start_time: Option<GlobalTimeOfDay>,
        pub duration: Option<Duration>,
        pub neurons_fund_investment_icp: Option<Tokens>,
        pub neurons_fund_participation: Option<bool>,
    }

    pub mod swap_parameters {
        use super::*;

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub struct NeuronBasketConstructionParameters {
            pub count: Option<u64>,
            pub dissolve_delay_interval: Option<Duration>,
        }
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct LedgerParameters {
        pub transaction_fee: Option<Tokens>,
        pub token_name: Option<String>,
        pub token_symbol: Option<String>,
        pub token_logo: Option<Image>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct GovernanceParameters {
        pub proposal_rejection_fee: Option<Tokens>,
        pub proposal_initial_voting_period: Option<Duration>,
        pub proposal_wait_for_quiet_deadline_increase: Option<Duration>,
        pub neuron_minimum_stake: Option<Tokens>,
        pub neuron_minimum_dissolve_delay_to_vote: Option<Duration>,
        pub neuron_maximum_dissolve_delay: Option<Duration>,
        pub neuron_maximum_dissolve_delay_bonus: Option<Percentage>,
        pub neuron_maximum_age_for_age_bonus: Option<Duration>,
        pub neuron_maximum_age_bonus: Option<Percentage>,
        pub voting_reward_parameters: Option<governance_parameters::VotingRewardParameters>,
    }

    pub mod governance_parameters {
        use super::*;

        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub struct VotingRewardParameters {
            pub initial_reward_rate: Option<Percentage>,
            pub final_reward_rate: Option<Percentage>,
            pub reward_rate_transition_duration: Option<Duration>,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NeuronId {
    pub id: u64,
}

impl From<u64> for NeuronId {
    fn from(value: u64) -> Self {
        NeuronId { id: value }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalId {
    pub id: u64,
}

impl From<u64> for ProposalId {
    fn from(value: u64) -> Self {
        ProposalId { id: value }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Tokens {
    pub e8s: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Duration {
    pub seconds: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Percentage {
    pub basis_points: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Canister {
    pub id: Option<Principal>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Image {
    pub base64_encoding: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GlobalTimeOfDay {
    pub seconds_after_utc_midnight: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Countries {
    pub iso_codes: Vec<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AccountIdentifier {
    pub hash: Vec<u8>,
}

impl TryFrom<ProposalInfo> for types::Proposal {
    type Error = String;

    fn try_from(value: ProposalInfo) -> Result<Self, Self::Error> {
        types::NnsProposal::try_from(value).map(types::Proposal::NNS)
    }
}

impl TryFrom<ProposalInfo> for types::NnsProposal {
    type Error = String;

    fn try_from(p: ProposalInfo) -> Result<Self, Self::Error> {
        let now = canister_time::now_millis();
        let proposal = p.proposal.ok_or("proposal not set".to_string())?;

        Ok(types::NnsProposal {
            id: p.id.ok_or("id not set".to_string())?.id,
            topic: p.topic,
            proposer: p.proposer.ok_or("proposer not set".to_string())?.id,
            created: p.proposal_timestamp_seconds * 1000,
            title: proposal.title.ok_or("title not set".to_string())?,
            summary: proposal.summary,
            url: proposal.url,
            status: p.status.try_into().map_err(|s| format!("unknown status: {s}"))?,
            reward_status: p
                .reward_status
                .try_into()
                .map_err(|r| format!("unknown reward status: {r}"))?,
            tally: p.latest_tally.map(|t| t.into()).unwrap_or_default(),
            deadline: p
                .deadline_timestamp_seconds
                .map(|ts| ts * 1000)
                .ok_or("deadline not set".to_string())?,
            payload_text_rendering: proposal
                .action
                .map(|a| serde_json::to_string_pretty(&a).unwrap_or("Failed to serialize payload".to_string())),
            last_updated: now,
        })
    }
}

impl From<Tally> for types::Tally {
    fn from(value: Tally) -> types::Tally {
        types::Tally {
            yes: value.yes,
            no: value.no,
            total: value.total,
            timestamp: value.timestamp_seconds * 1000,
        }
    }
}
