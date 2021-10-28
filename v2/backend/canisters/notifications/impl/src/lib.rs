use crate::model::subscriptions::Subscriptions;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use std::time::Duration;
use types::{Cycles, NotificationEnvelope, TimestampMillis};
use utils::env::Environment;
use utils::event_stream::EventStream;
use utils::memory;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MAX_SUBSCRIPTION_AGE: Duration = Duration::from_secs(365 * 24 * 60 * 60); // 365 days
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Serialize, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
}

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_push_service(&self) -> bool {
        self.data.push_service_principals.contains(&self.env.caller())
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            queued_notifications: self.data.notifications.len() as u32,
            subscriptions: self.data.subscriptions.total(),
            users: self.data.subscriptions.users(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub push_service_principals: HashSet<Principal>,
    pub notifications: EventStream<NotificationEnvelope>,
    pub subscriptions: Subscriptions,
    pub test_mode: bool,
}

impl Data {
    pub fn new(push_service_principals: Vec<Principal>, test_mode: bool) -> Data {
        Data {
            push_service_principals: push_service_principals.into_iter().collect(),
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
    pub queued_notifications: u32,
    pub subscriptions: u64,
    pub users: u64,
}
