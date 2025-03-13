use crate::model::notification_canisters_event_batch::NotificationCanistersEventBatch;
use crate::model::notifications_canister::NotificationsCanister;
use crate::model::subscriptions::Subscriptions;
use candid::Principal;
use canister_state_macros::canister_state;
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded, SubscriptionRemoved};
use principal_to_user_id_map::PrincipalToUserIdMap;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use stable_memory_map::UserIdsKeyPrefix;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet};
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    BuildVersion, CanisterId, CanisterWasm, Cycles, IdempotentEnvelope, SubscriptionInfo, TimestampMillis, Timestamped, UserId,
};
use user_ids_set::UserIdsSet;
use utils::canister::CanistersRequiringUpgrade;
use utils::env::Environment;
use utils::idempotency_checker::IdempotencyChecker;

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

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn is_caller_user_index_canister(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_registry_canister(&self) -> bool {
        self.env.caller() == self.data.registry_canister_id
    }

    pub fn is_caller_push_service(&self) -> bool {
        self.data.push_service_principals.contains(&self.env.caller())
    }

    pub fn add_subscription(&mut self, user_id: UserId, subscription: SubscriptionInfo, now: TimestampMillis) {
        let subscriptions_removed = self.data.subscriptions.push(user_id, subscription.clone());

        let event = NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded { user_id, subscription });

        self.push_event_to_notifications_canisters(event, now);

        for p256dh_key in subscriptions_removed {
            let event = NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved { user_id, p256dh_key });

            self.push_event_to_notifications_canisters(event, now);
        }
    }

    pub fn remove_subscription(&mut self, user_id: UserId, p256dh_key: String, now: TimestampMillis) {
        self.data.subscriptions.remove(user_id, &p256dh_key);

        let event = NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved { user_id, p256dh_key });

        self.push_event_to_notifications_canisters(event, now);
    }

    pub fn remove_all_subscriptions(&mut self, user_id: UserId, now: TimestampMillis) {
        self.data.subscriptions.remove_all(user_id);

        let event = NotificationsIndexEvent::AllSubscriptionsRemoved(user_id);

        self.push_event_to_notifications_canisters(event, now);
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            subscriptions: self.data.subscriptions.total(),
            users: self.data.principal_to_user_id_map.len() as u64,
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            push_service_principals: self.data.push_service_principals.iter().copied().collect(),
            notifications_canister_wasm_version: self.data.notifications_canister_wasm_for_new_canisters.version,
            notifications_canisters: self
                .data
                .notifications_canisters
                .iter()
                .map(|(k, v)| (*k, v.clone()))
                .collect(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }

    pub fn push_event_to_notifications_canisters(&mut self, event: NotificationsIndexEvent, now: TimestampMillis) {
        for canister_id in self.data.notifications_canisters.keys().copied() {
            self.data.notification_canisters_event_sync_queue.push(
                canister_id,
                IdempotentEnvelope {
                    created_at: now,
                    idempotency_id: self.env.rng().next_u64(),
                    value: event.clone(),
                },
            );
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub governance_principals: HashSet<Principal>,
    pub notifications_canisters: HashMap<CanisterId, NotificationsCanister>,
    pub push_service_principals: HashSet<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub registry_canister_id: CanisterId,
    pub principal_to_user_id_map: PrincipalToUserIdMap,
    pub subscriptions: Subscriptions,
    pub notifications_canister_wasm_for_new_canisters: CanisterWasm,
    pub notifications_canister_wasm_for_upgrades: CanisterWasm,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub notification_canisters_event_sync_queue: GroupedTimerJobQueue<NotificationCanistersEventBatch>,
    pub blocked_users: UserIdsSet,
    pub idempotency_checker: IdempotencyChecker,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: Vec<Principal>,
        push_service_principals: Vec<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        registry_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals: governance_principals.into_iter().collect(),
            notifications_canisters: HashMap::default(),
            push_service_principals: push_service_principals.into_iter().collect(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            registry_canister_id,
            principal_to_user_id_map: PrincipalToUserIdMap::default(),
            subscriptions: Subscriptions::default(),
            notifications_canister_wasm_for_new_canisters: CanisterWasm::default(),
            notifications_canister_wasm_for_upgrades: CanisterWasm::default(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            notification_canisters_event_sync_queue: GroupedTimerJobQueue::new(5, false),
            blocked_users: UserIdsSet::new(UserIdsKeyPrefix::new_for_blocked_users()),
            idempotency_checker: IdempotencyChecker::default(),
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
    pub subscriptions: u64,
    pub users: u64,
    pub governance_principals: Vec<Principal>,
    pub push_service_principals: Vec<Principal>,
    pub notifications_canister_wasm_version: BuildVersion,
    pub notifications_canisters: Vec<(CanisterId, NotificationsCanister)>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
