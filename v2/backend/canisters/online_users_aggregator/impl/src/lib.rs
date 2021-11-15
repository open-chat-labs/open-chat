use crate::model::online_users::OnlineUsers;
use candid::CandidType;
use canister_logger::LogMessagesWrapper;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{CanisterId, Timestamped, Version};
use utils::env::Environment;

mod lifecycle;
mod model;
mod updates;

const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Serialize, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub online_users: OnlineUsers,
    pub user_index_canister_id: CanisterId,
    pub test_mode: bool,
}

impl Data {
    pub fn new(user_index_canister_id: CanisterId, test_mode: bool) -> Data {
        Data {
            online_users: OnlineUsers::default(),
            user_index_canister_id,
            test_mode,
        }
    }
}
