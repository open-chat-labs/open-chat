use crate::model::authorized_principals::AuthorizedPrincipals;
use crate::model::subscriptions::Subscriptions;
use candid::Principal;
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, Cycles, NotificationEnvelope, TimestampMillis, Timestamped, Version};
use utils::env::Environment;
use utils::event_stream::EventStream;

mod guards;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
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

    pub fn is_caller_notifications_index(&self) -> bool {
        self.env.caller() == self.data.notifications_index_canister_id
    }

    pub fn is_caller_push_service(&self) -> bool {
        self.data.push_service_principals.contains(&self.env.caller())
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            queued_notifications: self.data.notifications.len() as u32,
            latest_notification_index: self.data.notifications.latest_event_index(),
            subscriptions: self.data.subscriptions.total(),
            push_service_principals: self.data.push_service_principals.iter().copied().collect(),
            canister_ids: CanisterIds {
                notifications_index: self.data.notifications_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub notifications_index_canister_id: CanisterId,
    pub push_service_principals: HashSet<Principal>,
    pub authorized_principals: AuthorizedPrincipals,
    pub cycles_dispenser_canister_id: CanisterId,
    pub notifications: EventStream<NotificationEnvelope>,
    pub subscriptions: Subscriptions,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        notifications_index_canister_id: CanisterId,
        push_service_principals: Vec<Principal>,
        authorizers: Vec<CanisterId>,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            notifications_index_canister_id,
            push_service_principals: push_service_principals.into_iter().collect(),
            authorized_principals: AuthorizedPrincipals::new(authorizers.into_iter().collect()),
            cycles_dispenser_canister_id,
            notifications: EventStream::default(),
            subscriptions: Subscriptions::default(),
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub queued_notifications: u32,
    pub latest_notification_index: u64,
    pub subscriptions: u64,
    pub push_service_principals: Vec<Principal>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub notifications_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
