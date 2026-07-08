use crate::model::attempts::AttemptHistory;
use crate::model::embeddings::EmbeddingStore;
use crate::model::models::{ModelRecord, ModelStore};
use crate::model::sessions::Sessions;
use candid::Principal;
use canister_state_macros::canister_state;
use personhood_verifier_canister::ModelKind;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped, UserId};
use utils::env::Environment;

mod engine;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

// tract transitively links `rand`, which on wasm32 requires a getrandom
// backend. Nothing security-sensitive uses it: challenge randomness comes
// from env.rng() (seeded via raw_rand). Inference is deterministic.
#[cfg(target_arch = "wasm32")]
getrandom::register_custom_getrandom!(deterministic_rand);

#[cfg(target_arch = "wasm32")]
fn deterministic_rand(buf: &mut [u8]) -> Result<(), getrandom::Error> {
    buf.fill(42);
    Ok(())
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

    pub fn is_caller_user_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.user_index_canister_id == caller
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
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            current_model_version: self.data.current_model_version,
            enrolled_embeddings: self.data.embeddings.count(self.data.current_model_version) as u64,
            open_sessions: self.data.sessions.count(),
            processing_queue_depth: self.data.processing_queue.len() as u64,
            users_with_attempts: self.data.attempts.len() as u64,
            detection_model: self.data.models.committed(ModelKind::Detection).cloned(),
            embedding_model: self.data.models.committed(ModelKind::Embedding).cloned(),
            inference_engines_ready: engine::real::engines_ready(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    #[serde(default)]
    pub governance_principals: HashSet<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub current_model_version: u16,
    #[serde(default)]
    pub models: ModelStore,
    // Heap for now; moves to stable structures before real scale (Phase 2)
    pub embeddings: EmbeddingStore,
    pub attempts: HashMap<UserId, AttemptHistory>,
    // Privacy invariant: sessions hold raw frames so they are heap-only and
    // structurally excluded from upgrade serialization. Upgrades void
    // in-flight sessions (~2 minute lifetime, acceptable).
    #[serde(skip)]
    pub sessions: Sessions,
    #[serde(skip)]
    pub processing_queue: VecDeque<u128>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: Vec<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals: governance_principals.into_iter().collect(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            // 0 = the pre-model stub era; the first committed embedding model
            // becomes version 1 and stub-enrolled embeddings stop matching
            current_model_version: 0,
            models: ModelStore::default(),
            embeddings: EmbeddingStore::default(),
            attempts: HashMap::new(),
            sessions: Sessions::default(),
            processing_queue: VecDeque::new(),
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
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub current_model_version: u16,
    pub enrolled_embeddings: u64,
    pub open_sessions: u64,
    pub processing_queue_depth: u64,
    pub users_with_attempts: u64,
    pub detection_model: Option<ModelRecord>,
    pub embedding_model: Option<ModelRecord>,
    pub inference_engines_ready: bool,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
