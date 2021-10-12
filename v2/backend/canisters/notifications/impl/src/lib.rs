use crate::model::subscriptions::Subscriptions;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesContainer;
use serde::Deserialize;
use std::cell::RefCell;
use std::collections::HashSet;
use std::time::Duration;
use types::NotificationEnvelope;
use utils::env::Environment;
use utils::event_stream::EventStream;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MAX_SUBSCRIPTION_AGE: Duration = Duration::from_secs(365 * 24 * 60 * 60); // 365 days
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesContainer> = RefCell::default();
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
}

#[derive(CandidType, Deserialize)]
struct Data {
    pub push_service_principals: HashSet<Principal>,
    pub notifications: EventStream<NotificationEnvelope>,
    pub subscriptions: Subscriptions,
}

impl Data {
    pub fn new(push_service_principals: Vec<Principal>) -> Data {
        Data {
            push_service_principals: push_service_principals.into_iter().collect(),
            notifications: EventStream::default(),
            subscriptions: Subscriptions::default(),
        }
    }
}
