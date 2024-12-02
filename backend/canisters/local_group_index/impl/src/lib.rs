use crate::model::local_community_map::LocalCommunityMap;
use candid::Principal;
use canister_state_macros::canister_state;
use constants::{CYCLES_REQUIRED_FOR_UPGRADE, MINUTE_IN_MS};
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use event_store_utils::EventDeduper;
use local_group_index_canister::ChildCanisterType;
use model::local_group_map::LocalGroupMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, VecDeque};
use std::time::Duration;
use types::{
    BuildVersion, CanisterId, CanisterWasm, ChildCanisterWasms, Cycles, Milliseconds, TimestampMillis, Timestamped, UserId,
};
use utils::canister;
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;
use utils::iterator_extensions::IteratorExtensions;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const GROUP_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + GROUP_CANISTER_TOP_UP_AMOUNT; // 0.5T cycles
const COMMUNITY_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = GROUP_CANISTER_INITIAL_CYCLES_BALANCE;
const GROUP_CANISTER_TOP_UP_AMOUNT: Cycles = 200_000_000_000; // 0.2T cycles
const COMMUNITY_CANISTER_TOP_UP_AMOUNT: Cycles = GROUP_CANISTER_TOP_UP_AMOUNT;
const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes

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

    pub fn is_caller_group_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.group_index_canister_id == caller
    }

    pub fn is_caller_local_group_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_groups.get(&caller.into()).is_some()
    }

    pub fn is_caller_local_community_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_communities.get(&caller.into()).is_some()
    }

    pub fn is_caller_notifications_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.notifications_canister_id == caller
    }

    pub fn metrics(&self) -> Metrics {
        let group_upgrades_metrics = self.data.groups_requiring_upgrade.metrics();
        let community_upgrades_metrics = self.data.communities_requiring_upgrade.metrics();
        let event_store_client_info = self.data.event_store_client.info();
        let event_relay_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_group_count: self.data.local_groups.len() as u64,
            local_community_count: self.data.local_communities.len() as u64,
            group_upgrades_completed: group_upgrades_metrics.completed,
            group_upgrades_pending: group_upgrades_metrics.pending as u64,
            group_upgrades_in_progress: group_upgrades_metrics.in_progress as u64,
            community_upgrades_completed: community_upgrades_metrics.completed,
            community_upgrades_pending: community_upgrades_metrics.pending as u64,
            community_upgrades_in_progress: community_upgrades_metrics.in_progress as u64,
            group_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::Group).wasm.version,
            community_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::Community).wasm.version,
            max_concurrent_group_upgrades: self.data.max_concurrent_group_upgrades,
            group_upgrade_concurrency: self.data.group_upgrade_concurrency,
            max_concurrent_community_upgrades: self.data.max_concurrent_community_upgrades,
            community_upgrade_concurrency: self.data.community_upgrade_concurrency,
            event_store_client_info,
            group_versions: self
                .data
                .local_groups
                .iter()
                .map(|g| g.1.wasm_version.to_string())
                .count_per_value(),
            community_versions: self
                .data
                .local_communities
                .iter()
                .map(|c| c.1.wasm_version.to_string())
                .count_per_value(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                notifications: self.data.notifications_canister_id,
                proposals_bot: self.data.proposals_bot_user_id.into(),
                escrow: self.data.escrow_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                event_relay: event_relay_canister_id,
                internet_identity: self.data.internet_identity_canister_id,
            },
            group_upgrades_failed: group_upgrades_metrics.failed,
            community_upgrades_failed: community_upgrades_metrics.failed,
            cycles_balance_check_queue_len: self.data.cycles_balance_check_queue.len() as u32,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub local_groups: LocalGroupMap,
    pub local_communities: LocalCommunityMap,
    pub child_canister_wasms: ChildCanisterWasms<ChildCanisterType>,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub groups_requiring_upgrade: CanistersRequiringUpgrade,
    pub communities_requiring_upgrade: CanistersRequiringUpgrade,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub escrow_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub test_mode: bool,
    pub max_concurrent_group_upgrades: u32,
    pub group_upgrade_concurrency: u32,
    pub max_concurrent_community_upgrades: u32,
    pub community_upgrade_concurrency: u32,
    pub video_call_operators: Vec<Principal>,
    #[serde(with = "serde_bytes")]
    pub ic_root_key: Vec<u8>,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    pub event_deduper: EventDeduper,
    pub rng_seed: [u8; 32],
    pub cycles_balance_check_queue: VecDeque<CanisterId>,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        group_canister_wasm: CanisterWasm,
        community_canister_wasm: CanisterWasm,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        escrow_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        ic_root_key: Vec<u8>,
        canister_pool_target_size: u16,
        test_mode: bool,
    ) -> Self {
        Data {
            local_groups: LocalGroupMap::default(),
            local_communities: LocalCommunityMap::default(),
            child_canister_wasms: ChildCanisterWasms::new(vec![
                (ChildCanisterType::Group, group_canister_wasm),
                (ChildCanisterType::Community, community_canister_wasm),
            ]),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            notifications_canister_id,
            cycles_dispenser_canister_id,
            proposals_bot_user_id,
            escrow_canister_id,
            internet_identity_canister_id,
            groups_requiring_upgrade: CanistersRequiringUpgrade::default(),
            communities_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            test_mode,
            max_concurrent_group_upgrades: 10,
            group_upgrade_concurrency: 10,
            max_concurrent_community_upgrades: 10,
            community_upgrade_concurrency: 2,
            rng_seed: [0; 32],
            video_call_operators,
            ic_root_key,
            event_store_client: EventStoreClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_millis(MINUTE_IN_MS))
                .build(),
            event_deduper: EventDeduper::default(),
            cycles_balance_check_queue: VecDeque::new(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub local_group_count: u64,
    pub local_community_count: u64,
    pub canisters_in_pool: u16,
    pub group_upgrades_completed: u64,
    pub group_upgrades_pending: u64,
    pub group_upgrades_in_progress: u64,
    pub community_upgrades_completed: u64,
    pub community_upgrades_pending: u64,
    pub community_upgrades_in_progress: u64,
    pub group_wasm_version: BuildVersion,
    pub community_wasm_version: BuildVersion,
    pub max_concurrent_group_upgrades: u32,
    pub group_upgrade_concurrency: u32,
    pub max_concurrent_community_upgrades: u32,
    pub community_upgrade_concurrency: u32,
    pub event_store_client_info: EventStoreClientInfo,
    pub group_versions: BTreeMap<String, u32>,
    pub community_versions: BTreeMap<String, u32>,
    pub canister_ids: CanisterIds,
    pub group_upgrades_failed: Vec<FailedUpgradeCount>,
    pub community_upgrades_failed: Vec<FailedUpgradeCount>,
    pub cycles_balance_check_queue_len: u32,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub notifications: CanisterId,
    pub proposals_bot: CanisterId,
    pub escrow: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub event_relay: CanisterId,
    pub internet_identity: CanisterId,
}
