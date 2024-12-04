use crate::model::nervous_systems::NervousSystems;
use crate::timer_job_types::TimerJob;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use fire_and_forget_handler::FireAndForgetHandler;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::cell::RefCell;
use std::collections::{HashSet, VecDeque};
use types::{
    BuildVersion, CanisterId, Cycles, MessageId, Milliseconds, MultiUserChat, NnsNeuronId, ProposalId, TimestampMillis,
    Timestamped,
};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod proposals;
mod queries;
mod timer_job_types;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            nervous_systems: self.data.nervous_systems.metrics(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            finished_proposals_to_process: self.data.finished_proposals_to_process.iter().copied().collect(),
            registry_synced_up_to: self.data.registry_synced_up_to,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                registry: self.data.registry_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                nns_governance: self.data.nns_governance_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub nervous_systems: NervousSystems,
    pub governance_principals: HashSet<Principal>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub nns_governance_canister_id: CanisterId,
    pub registry_canister_id: CanisterId,
    pub finished_proposals_to_process: VecDeque<(CanisterId, ProposalId)>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub registry_synced_up_to: TimestampMillis,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub nns_proposals_scheduled_to_vote_on: HashSet<ProposalId>,
    pub nns_neuron_to_vote_with: Option<NnsNeuronId>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        registry_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        nns_governance_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            nervous_systems: NervousSystems::default(),
            governance_principals,
            user_index_canister_id,
            group_index_canister_id,
            registry_canister_id,
            cycles_dispenser_canister_id,
            nns_governance_canister_id,
            finished_proposals_to_process: VecDeque::new(),
            timer_jobs: TimerJobs::default(),
            registry_synced_up_to: 0,
            fire_and_forget_handler: FireAndForgetHandler::default(),
            nns_proposals_scheduled_to_vote_on: HashSet::new(),
            nns_neuron_to_vote_with: None,
            rng_seed: [0; 32],
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub nervous_systems: Vec<NervousSystemMetrics>,
    pub governance_principals: Vec<Principal>,
    pub finished_proposals_to_process: Vec<(CanisterId, ProposalId)>,
    pub registry_synced_up_to: TimestampMillis,
    pub canister_ids: CanisterIds,
}

#[derive(CandidType, Serialize, Debug)]
pub struct NervousSystemMetrics {
    pub governance_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub chat_id: MultiUserChat,
    pub latest_successful_sync: Option<TimestampMillis>,
    pub latest_failed_sync: Option<TimestampMillis>,
    pub latest_successful_proposals_update: Option<TimestampMillis>,
    pub latest_failed_proposals_update: Option<TimestampMillis>,
    pub queued_proposals: Vec<ProposalId>,
    pub active_proposals: Vec<ProposalId>,
    pub active_user_submitted_proposals: Vec<ProposalId>,
    pub neuron_for_submitting_proposals: Option<String>,
    pub neuron_for_submitting_proposals_dissolve_delay: Milliseconds,
    pub transaction_fee: u64,
    pub min_neuron_stake: u64,
    pub min_dissolve_delay_to_vote: Milliseconds,
    pub proposal_rejection_fee: u64,
    pub disabled: bool,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub registry: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub nns_governance: CanisterId,
}

// Deterministically generate each MessageId so that there is never any chance of a proposal
// being sent twice
fn generate_message_id(governance_canister_id: CanisterId, proposal_id: ProposalId) -> MessageId {
    let mut hash = Sha256::new();
    hash.update(b"proposals_bot");
    hash.update(governance_canister_id.as_slice());
    hash.update(proposal_id.to_ne_bytes());
    let array32: [u8; 32] = hash.finalize().into();
    let array8: [u8; 8] = array32[..8].try_into().unwrap();
    u128::from(u64::from_ne_bytes(array8)).into()
}
