use crate::model::airdrop_bot_event_batch::AirdropBotEventBatch;
use crate::model::last_online_dates::LastOnlineDates;
use crate::model::user_online_minutes::UserOnlineMinutes;
use canister_state_macros::canister_state;
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use principal_to_user_id_map::PrincipalToUserIdMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::time::Duration;
use timer_job_queues::GroupedTimerJobQueue;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

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

    pub fn metrics(&self) -> Metrics {
        let event_store_client_info = self.data.event_store_client.info();
        let event_store_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            mark_as_online_count: self.data.mark_as_online_count,
            active_users: self.data.cached_active_users.clone(),
            sync_online_minutes_to_airdrop_bot_increment: self.data.sync_online_minutes_to_airdrop_bot_increment,
            event_store_client_info,
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                airdrop_bot: self.data.airdrop_bot_canister_id,
                event_relay: event_store_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub last_online_dates: LastOnlineDates,
    #[serde(default)]
    pub user_online_minutes: UserOnlineMinutes,
    pub principal_to_user_id_map: PrincipalToUserIdMap,
    pub user_index_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub airdrop_bot_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    pub mark_as_online_count: u64,
    pub cached_active_users: ActiveUsers,
    #[serde(default = "airdrop_bot_event_sync_queue")]
    pub airdrop_bot_event_sync_queue: GroupedTimerJobQueue<AirdropBotEventBatch>,
    #[serde(default = "sixty")]
    pub sync_online_minutes_to_airdrop_bot_increment: u16,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

fn sixty() -> u16 {
    60
}

fn airdrop_bot_event_sync_queue() -> GroupedTimerJobQueue<AirdropBotEventBatch> {
    GroupedTimerJobQueue::new(1, false)
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        airdrop_bot_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        sync_online_minutes_to_airdrop_bot_increment: u16,
        test_mode: bool,
    ) -> Data {
        Data {
            last_online_dates: LastOnlineDates::default(),
            user_online_minutes: UserOnlineMinutes::default(),
            principal_to_user_id_map: PrincipalToUserIdMap::default(),
            user_index_canister_id,
            airdrop_bot_canister_id,
            cycles_dispenser_canister_id,
            event_store_client: EventStoreClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            mark_as_online_count: 0,
            cached_active_users: ActiveUsers::default(),
            airdrop_bot_event_sync_queue: GroupedTimerJobQueue::new(1, false),
            sync_online_minutes_to_airdrop_bot_increment,
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
    pub mark_as_online_count: u64,
    pub active_users: ActiveUsers,
    pub sync_online_minutes_to_airdrop_bot_increment: u16,
    pub event_store_client_info: EventStoreClientInfo,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ActiveUsers {
    timestamp: TimestampMillis,
    last_5_minutes: u32,
    last_hour: u32,
    last_day: u32,
    last_7_days: u32,
    last_30_days: u32,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub airdrop_bot: CanisterId,
    pub event_relay: CanisterId,
    pub cycles_dispenser: CanisterId,
}
