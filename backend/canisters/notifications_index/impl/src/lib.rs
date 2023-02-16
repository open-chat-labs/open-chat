use crate::model::notifications_canister::NotificationsCanister;
use crate::model::subscriptions::Subscriptions;
use candid::Principal;
use canister_state_macros::canister_state;
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded, SubscriptionRemoved};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use types::{CanisterId, CanisterWasm, Cycles, SubscriptionInfo, TimestampMillis, Timestamped, UserId, Version};
use utils::canister::CanistersRequiringUpgrade;
use utils::canister_event_sync_queue::CanisterEventSyncQueue;
use utils::env::Environment;

mod guards;
mod jobs;
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

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_push_service(&self) -> bool {
        self.data.push_service_principals.contains(&self.env.caller())
    }

    pub fn add_subscription(&mut self, user_id: UserId, subscription: SubscriptionInfo) {
        self.data.subscriptions.push(user_id, subscription.clone());

        let event = NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded { user_id, subscription });

        self.push_event_to_notifications_canisters(event);
    }

    pub fn remove_subscription(&mut self, user_id: UserId, p256dh_key: String) {
        self.data.subscriptions.remove(user_id, &p256dh_key);

        let event = NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved { user_id, p256dh_key });

        self.push_event_to_notifications_canisters(event);
    }

    pub fn remove_all_subscriptions(&mut self, user_id: UserId) {
        self.data.subscriptions.remove_all(user_id);

        let event = NotificationsIndexEvent::AllSubscriptionsRemoved(user_id);

        self.push_event_to_notifications_canisters(event);
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            subscriptions: self.data.subscriptions.total(),
            users: self.data.principal_to_user_id.len() as u64,
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            notifications_canister_wasm_version: self.data.notifications_canister_wasm_for_new_canisters.version,
            notifications_canisters: self
                .data
                .notifications_canisters
                .iter()
                .map(|(k, v)| (*k, v.clone()))
                .collect(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }

    fn push_event_to_notifications_canisters(&mut self, event: NotificationsIndexEvent) {
        for canister_id in self.data.notifications_canisters.keys().copied() {
            self.data
                .notifications_index_event_sync_queue
                .push(canister_id, event.clone());
        }
        jobs::sync_notifications_canisters::start_job_if_required(self);
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    #[serde(alias = "service_principals")]
    pub governance_principals: HashSet<Principal>,
    pub notifications_canisters: HashMap<CanisterId, NotificationsCanister>,
    pub push_service_principals: HashSet<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub principal_to_user_id: HashMap<Principal, UserId>,
    pub subscriptions: Subscriptions,
    #[serde(alias = "notifications_canister_wasm")]
    pub notifications_canister_wasm_for_new_canisters: CanisterWasm,
    #[serde(default)]
    pub notifications_canister_wasm_for_upgrades: CanisterWasm,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub notifications_index_event_sync_queue: CanisterEventSyncQueue<NotificationsIndexEvent>,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: Vec<Principal>,
        push_service_principals: Vec<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        notifications_canister_wasm: CanisterWasm,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals: governance_principals.into_iter().collect(),
            notifications_canisters: HashMap::default(),
            push_service_principals: push_service_principals.into_iter().collect(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            principal_to_user_id: HashMap::default(),
            subscriptions: Subscriptions::default(),
            notifications_canister_wasm_for_new_canisters: notifications_canister_wasm.clone(),
            notifications_canister_wasm_for_upgrades: notifications_canister_wasm,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            notifications_index_event_sync_queue: CanisterEventSyncQueue::default(),
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
    pub subscriptions: u64,
    pub users: u64,
    pub governance_principals: Vec<Principal>,
    pub notifications_canister_wasm_version: Version,
    pub notifications_canisters: Vec<(CanisterId, NotificationsCanister)>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
