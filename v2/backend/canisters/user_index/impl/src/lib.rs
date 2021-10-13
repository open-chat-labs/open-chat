use crate::model::user_map::UserMap;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use serde::Deserialize;
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, CanisterWasm, ConfirmationCodeSms};
use utils::canister;
use utils::env::Environment;
use utils::event_stream::EventStream;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MIN_CYCLES_BALANCE: u64 = 5_000_000_000_000; // 5T
const USER_CANISTER_INITIAL_CYCLES_BALANCE: u64 = 150_000_000_000; // 0.15T cycles
const USER_CANISTER_TOP_UP_AMOUNT: u64 = 100_000_000_000; // 0.1T cycles
const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Deserialize)]
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

    /// Traps if the caller is not an OpenChat user or an OpenChat user's canister
    pub fn trap_if_caller_not_open_chat_user(&self) {
        let caller = self.env.caller();

        if !self.data.users.is_valid_caller(caller) {
            #[cfg(not(test))]
            ic_cdk::trap("Not authorized");
        }
    }

    pub fn is_caller_sms_service(&self) -> bool {
        let caller = self.env.caller();

        self.data.sms_service_principals.contains(&caller)
    }
}

#[derive(CandidType, Deserialize)]
struct Data {
    pub users: UserMap,
    pub service_principals: HashSet<Principal>,
    pub user_canister_wasm: CanisterWasm,
    pub sms_service_principals: HashSet<Principal>,
    pub sms_messages: EventStream<ConfirmationCodeSms>,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub canister_pool: canister::Pool,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        service_principals: Vec<Principal>,
        sms_service_principals: Vec<Principal>,
        user_canister_wasm: CanisterWasm,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        canister_pool_target_size: u16,
        test_mode: bool,
    ) -> Self {
        Data {
            users: UserMap::default(),
            service_principals: service_principals.into_iter().collect(),
            user_canister_wasm,
            sms_service_principals: sms_service_principals.into_iter().collect(),
            sms_messages: EventStream::default(),
            group_index_canister_id,
            notifications_canister_id,
            canister_pool: canister::Pool::new(canister_pool_target_size),
            test_mode,
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
            sms_service_principals: HashSet::new(),
            sms_messages: EventStream::default(),
            group_index_canister_id: Principal::anonymous(),
            notifications_canister_id: Principal::anonymous(),
            canister_pool: canister::Pool::new(5),
            test_mode: true,
        }
    }
}
