use crate::model::local_index_event_batch::LocalIndexEventBatch;
use crate::model::subscriptions::{SubscriptionInfoInternal, Subscriptions};
use candid::Principal;
use canister_state_macros::canister_state;
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded, SubscriptionRemoved};
use principal_to_user_id_map::PrincipalToUserIdMap;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    ApnsDevice, ApnsToken, BuildVersion, CanisterId, Cycles, FcmToken, IdempotentEnvelope, SubscriptionInfo, TimestampMillis,
    Timestamped, UserId,
};
use utils::apns_device_store::ApnsDeviceStore;
use utils::env::Environment;
use utils::fcm_token_store::{FcmTokenAddResult, FcmTokenStore};

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
                last_active: now,
                endpoint: subscription.endpoint.clone(),
                keys: subscription.keys.clone(),
            },
        );

        let event = NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded { user_id, subscription });

        self.push_event_to_local_indexes(event, now);

        for removed in subscriptions_removed {
            let event = NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved {
                user_id,
                endpoint: removed.endpoint,
            });

            self.push_event_to_local_indexes(event, now);
        }
    }

    pub fn remove_subscription(&mut self, user_id: UserId, endpoint: String, now: TimestampMillis) {
        if self.data.subscriptions.remove(user_id, &endpoint).is_some() {
            self.push_event_to_local_indexes(
                NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved { user_id, endpoint }),
                now,
            );
        }
    }

    pub fn remove_all_subscriptions(&mut self, user_id: UserId, now: TimestampMillis) {
        self.data.subscriptions.remove_all(user_id);

        let event = NotificationsIndexEvent::AllSubscriptionsRemoved(user_id);

        self.push_event_to_local_indexes(event, now);
    }

    pub fn add_fcm_token(&mut self, user_id: UserId, fcm_token: FcmToken) {
        let now = self.env.now();
        match self.data.fcm_token_store.add(user_id, fcm_token.clone()) {
            FcmTokenAddResult::Added => {
                self.push_event_to_local_indexes(NotificationsIndexEvent::FcmTokenAdded(user_id, fcm_token), now);
            }
            FcmTokenAddResult::Reassigned(previous_owner) => {
                // Keep the local index replicas consistent: drop the old owner's
                // mapping before adding the new one.
                self.push_event_to_local_indexes(
                    NotificationsIndexEvent::FcmTokenRemoved(previous_owner, fcm_token.clone()),
                    now,
                );
                self.push_event_to_local_indexes(NotificationsIndexEvent::FcmTokenAdded(user_id, fcm_token), now);
            }
            FcmTokenAddResult::AlreadyOwned => {}
        }
    }

    // Called when a push to Firebase fails because the token is no longer valid
    // (FCM `UNREGISTERED`), so we stop pushing to dead tokens.
    pub fn remove_fcm_token(&mut self, user_id: UserId, fcm_token: FcmToken) -> Result<(), String> {
        self.data.fcm_token_store.remove(&user_id, &fcm_token).map(|_| {
            self.push_event_to_local_indexes(NotificationsIndexEvent::FcmTokenRemoved(user_id, fcm_token), self.env.now());
        })
    }

    // Last login wins, so registering may take the device from another user. The local indexes
    // apply the same registration and reach the same state.
    pub fn register_apns_device(&mut self, user_id: UserId, device: ApnsDevice) {
        if self.data.apns_device_store.register(user_id, device.clone()) {
            self.push_event_to_local_indexes(NotificationsIndexEvent::ApnsDeviceRegistered(user_id, device), self.env.now());
        }
    }

    // On sign-out: the whole device goes, both of its tokens
    pub fn remove_apns_device(&mut self, user_id: UserId, device: ApnsDevice) {
        if self.data.apns_device_store.remove_device(&user_id, &device) {
            self.push_event_to_local_indexes(NotificationsIndexEvent::ApnsDeviceRemoved(user_id, device), self.env.now());
        }
    }

    // When APNs rejects a token: only that token goes
    pub fn remove_apns_token(&mut self, user_id: UserId, token: ApnsToken) {
        if self.data.apns_device_store.remove_token(&user_id, &token) {
            self.push_event_to_local_indexes(NotificationsIndexEvent::ApnsTokenRemoved(user_id, token), self.env.now());
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            subscriptions: self.data.subscriptions.total(),
            apns_devices: self.data.apns_device_store.len() as u64,
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
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
    pub fcm_token_store: FcmTokenStore,
    #[serde(default)]
    pub apns_device_store: ApnsDeviceStore,
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
            rng_seed: [0; 32],
            test_mode,
            fcm_token_store: FcmTokenStore::default(),
            apns_device_store: ApnsDeviceStore::default(),
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
    pub apns_devices: u64,
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

#[cfg(test)]
mod tests {
    use super::*;

    // #10398 invariant 8: state saved by a wasm from before APNs devices has no device store
    #[test]
    fn invariant_8_state_saved_before_apns_devices_keeps_every_fcm_token() {
        let canister = |text| CanisterId::from_text(text).unwrap();
        let alice = UserId::new(canister("3skqk-iqaaa-aaaaf-aaa3q-cai"));
        let mut data = Data::new(
            Vec::new(),
            Vec::new(),
            canister("4bkt6-4aaaa-aaaaf-aaaiq-cai"),
            canister("gonut-hqaaa-aaaaf-aby7a-cai"),
            canister("cpi5u-yiaaa-aaaar-aqw5a-cai"),
            true,
        );
        data.fcm_token_store.add(alice, FcmToken("android".to_string()));

        let rmpv::Value::Map(mut fields) =
            rmpv::decode::read_value(&mut msgpack::serialize_then_unwrap(&data).as_slice()).unwrap()
        else {
            panic!("state is a map");
        };
        fields.retain(|(k, _)| k.as_str() != Some("apns_device_store"));
        let value = rmpv::Value::Map(fields);
        let mut old_bytes = Vec::new();
        rmpv::encode::write_value(&mut old_bytes, &value).unwrap();

        let upgraded: Data = msgpack::deserialize_then_unwrap(&old_bytes);
        assert_eq!(
            upgraded.fcm_token_store.get_for_user(&alice),
            vec![&FcmToken("android".to_string())]
        );
        assert!(upgraded.apns_device_store.is_empty());
    }
}
