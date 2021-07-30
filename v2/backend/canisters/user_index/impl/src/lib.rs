use crate::model::user_map::UserMap;
use candid::Principal;
use shared::canisters::canister_wasm::CanisterWasm;
use shared::env::Environment;
use shared::event_stream::EventStream;
use shared::types::CanisterId;
use std::cell::RefCell;
use std::collections::HashSet;
use user_index_canister::common::confirmation_code_sms::ConfirmationCodeSms;

mod lifecycle;
mod model;
mod queries;
mod updates;

pub const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour
pub const MIN_CYCLES_BALANCE: u64 = 5_000_000_000_000; // 5T
pub const USER_CANISTER_INITIAL_CYCLES_BALANCE: u64 = 150_000_000_000; // 0.15T cycles

thread_local! {
    pub static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
}

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_sms_service(&self) -> bool {
        let caller = self.env.caller();

        self.data.sms_service_principals.contains(&caller)
    }
}

pub struct Data {
    pub users: UserMap,
    pub service_principals: HashSet<Principal>,
    pub user_canister_wasm: CanisterWasm,
    pub sms_service_principals: HashSet<Principal>,
    pub sms_messages: EventStream<ConfirmationCodeSms>,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
}

impl Data {
    pub fn new(
        service_principals: Vec<Principal>,
        sms_service_principals: Vec<Principal>,
        user_canister_wasm: CanisterWasm,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
    ) -> Self {
        Data {
            users: UserMap::default(),
            service_principals: service_principals.into_iter().collect(),
            user_canister_wasm,
            sms_service_principals: sms_service_principals.into_iter().collect(),
            sms_messages: EventStream::default(),
            group_index_canister_id,
            notifications_canister_id,
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
        }
    }
}
