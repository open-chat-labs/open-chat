use crate::model::challenges::Challenges;
use crate::model::failed_messages_pending_retry::FailedMessagesPendingRetry;
use crate::model::open_storage_user_sync_queue::OpenStorageUserSyncQueue;
use crate::model::set_user_suspended_queue::SetUserSuspendedQueue;
use crate::model::user_map::UserMap;
use crate::model::user_principal_migration_queue::UserPrincipalMigrationQueue;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use local_user_index_canister::c2c_notify_user_index_events::UserIndexEvent;
use model::local_user_index_map::LocalUserIndexMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashSet, VecDeque};
use types::{
    CanisterId, CanisterWasm, ChatId, ConfirmationCodeSms, Cycles, Milliseconds, TimestampMillis, Timestamped, UserId, Version,
};
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::canister_event_sync_queue::CanisterEventSyncQueue;
use utils::env::Environment;
use utils::event_stream::EventStream;
use utils::memory;
use utils::time::{DAY_IN_MS, MINUTE_IN_MS};

mod guards;
mod lifecycle;
mod model;
mod queries;
mod updates;

pub const USER_LIMIT: usize = 70_000;

const USER_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles
const CONFIRMED_PHONE_NUMBER_STORAGE_ALLOWANCE: u64 = (1024 * 1024 * 1024) / 10; // 0.1 GB
const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 10 * MINUTE_IN_MS; // 10 minutes
const TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS: Milliseconds = DAY_IN_MS * 90; // 90 days

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

    /// Traps if the caller is not an OpenChat user or an OpenChat user's canister
    pub fn trap_if_caller_not_open_chat_user(&self) {
        let caller = self.env.caller();

        if !self.data.users.is_valid_caller(caller) {
            #[cfg(not(test))]
            ic_cdk::trap("Not authorized");
        }
    }

    pub fn is_caller_service_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.service_principals.contains(&caller)
    }

    pub fn is_caller_group_index_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.group_index_canister_id
    }

    pub fn is_caller_sms_service(&self) -> bool {
        let caller = self.env.caller();
        self.data.sms_service_principals.contains(&caller)
    }

    pub fn is_caller_super_admin(&self) -> bool {
        let caller = self.env.caller();
        if let Some(user) = self.data.users.get_by_principal(&caller) {
            self.data.super_admins.contains(&user.user_id)
        } else {
            false
        }
    }

    pub fn generate_6_digit_code(&mut self) -> String {
        let random = self.env.random_u32();
        format!("{:0>6}", random % 1000000)
    }

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            users_created: self.data.users.len() as u64,
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            user_wasm_version: self.data.user_canister_wasm.version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
            sms_messages_in_queue: self.data.sms_messages.len() as u32,
            super_admins: self.data.super_admins.len() as u8,
            super_admins_to_dismiss: self.data.super_admins_to_dismiss.len() as u32,
            inflight_challenges: self.data.challenges.count(),
            user_index_events_queue_length: self.data.user_index_event_sync_queue.len(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub users: UserMap,
    pub service_principals: HashSet<Principal>,
    pub user_canister_wasm: CanisterWasm,
    pub local_user_index_canister_wasm: CanisterWasm,
    pub sms_service_principals: HashSet<Principal>,
    pub sms_messages: EventStream<ConfirmationCodeSms>,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cycles_dispenser_canister_id: CanisterId,
    pub open_storage_index_canister_id: CanisterId,
    pub open_storage_user_sync_queue: OpenStorageUserSyncQueue,
    pub user_index_event_sync_queue: CanisterEventSyncQueue<UserIndexEvent>,
    pub user_principal_migration_queue: UserPrincipalMigrationQueue,
    pub ledger_canister_id: CanisterId,
    pub failed_messages_pending_retry: FailedMessagesPendingRetry,
    pub super_admins: HashSet<UserId>,
    pub super_admins_to_dismiss: VecDeque<(UserId, ChatId)>,
    pub test_mode: bool,
    pub challenges: Challenges,
    pub max_concurrent_canister_upgrades: usize,
    pub set_user_suspended_queue: SetUserSuspendedQueue,
    pub local_index_map: LocalUserIndexMap,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        service_principals: Vec<Principal>,
        sms_service_principals: Vec<Principal>,
        user_canister_wasm: CanisterWasm,
        local_user_index_canister_wasm: CanisterWasm,
        group_index_canister_id: CanisterId,
        notifications_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        open_storage_index_canister_id: CanisterId,
        ledger_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        test_mode: bool,
    ) -> Self {
        let mut users = UserMap::default();

        // Register the ProposalsBot
        users.register(
            proposals_bot_user_id.into(),
            proposals_bot_user_id,
            user_canister_wasm.version,
            "ProposalsBot".to_string(),
            0,
            None,
            true,
        );

        Data {
            users,
            service_principals: service_principals.into_iter().collect(),
            user_canister_wasm,
            local_user_index_canister_wasm,
            sms_service_principals: sms_service_principals.into_iter().collect(),
            sms_messages: EventStream::default(),
            group_index_canister_id,
            notifications_index_canister_id,
            cycles_dispenser_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            total_cycles_spent_on_canisters: 0,
            open_storage_index_canister_id,
            open_storage_user_sync_queue: OpenStorageUserSyncQueue::default(),
            user_index_event_sync_queue: CanisterEventSyncQueue::default(),
            user_principal_migration_queue: UserPrincipalMigrationQueue::default(),
            ledger_canister_id,
            failed_messages_pending_retry: FailedMessagesPendingRetry::default(),
            super_admins: HashSet::new(),
            super_admins_to_dismiss: VecDeque::new(),
            test_mode,
            challenges: Challenges::new(test_mode),
            max_concurrent_canister_upgrades: 2,
            set_user_suspended_queue: SetUserSuspendedQueue::default(),
            local_index_map: LocalUserIndexMap::default(),
        }
    }

    pub fn push_event_to_local_user_index(&mut self, user_id: UserId, event: UserIndexEvent) {
        if let Some(canister_id) = self.local_index_map.get_index_canister(&user_id) {
            self.user_index_event_sync_queue.push(canister_id, event);
        }
    }

    pub fn push_event_to_all_local_user_indexes(&mut self, event: UserIndexEvent) {
        for canister_id in self.local_index_map.canisters() {
            self.user_index_event_sync_queue.push(*canister_id, event.clone());
        }
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            users: UserMap::default(),
            service_principals: HashSet::new(),
            user_canister_wasm: CanisterWasm::default(),
            local_user_index_canister_wasm: CanisterWasm::default(),
            sms_service_principals: HashSet::new(),
            sms_messages: EventStream::default(),
            group_index_canister_id: Principal::anonymous(),
            notifications_index_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            total_cycles_spent_on_canisters: 0,
            open_storage_index_canister_id: Principal::anonymous(),
            open_storage_user_sync_queue: OpenStorageUserSyncQueue::default(),
            user_index_event_sync_queue: CanisterEventSyncQueue::default(),
            user_principal_migration_queue: UserPrincipalMigrationQueue::default(),
            ledger_canister_id: Principal::anonymous(),
            failed_messages_pending_retry: FailedMessagesPendingRetry::default(),
            super_admins: HashSet::new(),
            super_admins_to_dismiss: VecDeque::new(),
            test_mode: true,
            challenges: Challenges::new(true),
            max_concurrent_canister_upgrades: 2,
            set_user_suspended_queue: SetUserSuspendedQueue::default(),
            local_index_map: LocalUserIndexMap::default(),
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub users_created: u64,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub user_wasm_version: Version,
    pub max_concurrent_canister_upgrades: usize,
    pub sms_messages_in_queue: u32,
    pub super_admins: u8,
    pub super_admins_to_dismiss: u32,
    pub inflight_challenges: u32,
    pub user_index_events_queue_length: usize,
}
