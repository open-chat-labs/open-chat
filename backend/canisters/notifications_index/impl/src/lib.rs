use crate::model::local_index_event_batch::LocalIndexEventBatch;
use crate::model::subscriptions::{SubscriptionInfoInternal, Subscriptions};
use candid::Principal;
use canister_state_macros::canister_state;
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded, SubscriptionRemoved};
use principal_to_user_id_map::PrincipalToUserIdMap;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    BuildVersion, CanisterId, Cycles, FcmToken, IdempotentEnvelope, SubscriptionInfo, TimestampMillis, Timestamped, UserId,
};
use utils::env::Environment;
use utils::fcm_token_store::FcmTokenStore;
use utils::idempotency_checker::IdempotencyChecker;

mod guards;
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

    pub fn is_caller_registry_canister(&self) -> bool {
        self.env.caller() == self.data.registry_canister_id
    }

    pub fn is_caller_push_service(&self) -> bool {
        self.data.push_service_principals.contains(&self.env.caller())
    }

    pub fn add_subscription(&mut self, user_id: UserId, subscription: SubscriptionInfo, now: TimestampMillis) {
        let subscriptions_removed = self.data.subscriptions.push(
            user_id,
            SubscriptionInfoInternal {
                added: now,
                endpoint: subscription.endpoint.clone(),
                keys: subscription.keys.clone(),
            },
        );

        let event = NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded { user_id, subscription });

        self.push_event_to_local_indexes(event, now);

        for removed in subscriptions_removed {
            let event = NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved {
                user_id,
                p256dh_key: removed.keys.p256dh,
                endpoint: removed.endpoint,
            });

            self.push_event_to_local_indexes(event, now);
        }
    }

    pub fn remove_subscription(&mut self, user_id: UserId, endpoint: String, now: TimestampMillis) {
        if let Some(removed) = self.data.subscriptions.remove(user_id, &endpoint) {
            let event = NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved {
                user_id,
                endpoint: removed.endpoint,
                p256dh_key: removed.keys.p256dh,
            });

            self.push_event_to_local_indexes(event, now);
        }
    }

    pub fn remove_all_subscriptions(&mut self, user_id: UserId, now: TimestampMillis) {
        self.data.subscriptions.remove_all(user_id);

        let event = NotificationsIndexEvent::AllSubscriptionsRemoved(user_id);

        self.push_event_to_local_indexes(event, now);
    }

    pub fn add_fcm_token(&mut self, user_id: UserId, fcm_token: FcmToken) -> Result<(), String> {
        // Add token locally
        self.data.fcm_token_store.add(user_id, fcm_token.clone()).map(|_| {
            self.push_event_to_local_indexes(NotificationsIndexEvent::FcmTokenAdded(user_id, fcm_token), self.env.now());
        })
    }

    // TODO remove tokens when push to firebase fails
    #[allow(dead_code)]
    pub fn remove_fcm_token(&mut self, user_id: UserId, fcm_token: FcmToken) -> Result<(), String> {
        self.data.fcm_token_store.remove(&user_id, &fcm_token).map(|_| {
            self.push_event_to_local_indexes(NotificationsIndexEvent::FcmTokenRemoved(user_id, fcm_token), self.env.now());
        })
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
            subscriptions: self.data.subscriptions.total(),
            users: self.data.principal_to_user_id_map.len() as u64,
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            push_service_principals: self.data.push_service_principals.iter().copied().collect(),
            local_indexes: self.data.local_indexes.clone(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }

    pub fn push_event_to_local_indexes(&mut self, event: NotificationsIndexEvent, now: TimestampMillis) {
        for canister_id in self.data.local_indexes.iter() {
            self.data.local_index_event_sync_queue.push(
                *canister_id,
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
    pub local_indexes: BTreeSet<CanisterId>,
    pub push_service_principals: HashSet<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub registry_canister_id: CanisterId,
    pub principal_to_user_id_map: PrincipalToUserIdMap,
    pub subscriptions: Subscriptions,
    pub local_index_event_sync_queue: GroupedTimerJobQueue<LocalIndexEventBatch>,
    pub idempotency_checker: IdempotencyChecker,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
    pub fcm_token_store: FcmTokenStore,
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
            local_indexes: BTreeSet::default(),
            push_service_principals: push_service_principals.into_iter().collect(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            registry_canister_id,
            principal_to_user_id_map: PrincipalToUserIdMap::default(),
            subscriptions: Subscriptions::default(),
            local_index_event_sync_queue: GroupedTimerJobQueue::new(5, false),
            idempotency_checker: IdempotencyChecker::default(),
            rng_seed: [0; 32],
            test_mode,
            fcm_token_store: FcmTokenStore::default(),
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
    pub subscriptions: u64,
    pub users: u64,
    pub governance_principals: Vec<Principal>,
    pub push_service_principals: Vec<Principal>,
    pub local_indexes: BTreeSet<CanisterId>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
