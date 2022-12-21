use crate::model::subscriptions::Subscriptions;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use types::{CanisterId, Cycles, NotificationEnvelope, TimestampMillis, Timestamped, UserId, Version};
use utils::env::Environment;
use utils::event_stream::EventStream;
use utils::memory;

mod guards;
mod lifecycle;
mod model;
mod queries;
mod updates;

const MAX_SUBSCRIPTION_AGE: Duration = Duration::from_secs(365 * 24 * 60 * 60); // 365 days

thread_local! {
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
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

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_push_service(&self) -> bool {
        self.data.push_service_principals.contains(&self.env.caller())
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            queued_notifications: self.data.notifications.len() as u32,
            latest_notification_index: self.data.notifications.latest_event_index(),
            subscriptions: self.data.subscriptions.total(),
            users: self.data.principal_to_user_id.len() as u64,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub push_service_principals: HashSet<Principal>,
    pub user_index_canister_id: CanisterId,
    #[serde(default = "cycles_dispenser_canister_id")]
    pub cycles_dispenser_canister_id: CanisterId,
    pub principal_to_user_id: HashMap<Principal, UserId>,
    pub notifications: EventStream<NotificationEnvelope>,
    pub subscriptions: Subscriptions,
    pub test_mode: bool,
}

fn cycles_dispenser_canister_id() -> CanisterId {
    CanisterId::from_text("gonut-hqaaa-aaaaf-aby7a-cai").unwrap()
}

impl Data {
    pub fn new(
        push_service_principals: Vec<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            push_service_principals: push_service_principals.into_iter().collect(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            principal_to_user_id: HashMap::default(),
            notifications: EventStream::default(),
            subscriptions: Subscriptions::default(),
            test_mode,
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub queued_notifications: u32,
    pub latest_notification_index: u64,
    pub subscriptions: u64,
    pub users: u64,
}
