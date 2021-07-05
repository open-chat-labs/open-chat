use crate::model::runtime_state::RuntimeState;
use crate::model::user::User;
use candid::{CandidType, Principal};
use serde::Deserialize;
use shared::memory;
use shared::time::TimestampMillis;

const ONLINE_WINDOW_IN_MS: u64 = 2 * 60 * 1000; // 2 minutes
const ACTIVE_WINDOW_IN_MS: u64 = 7 * 24 * 60 * 60 * 1000; // 1 week

pub fn query(runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let mut response = Response {
        unconfirmed_user_count: 0,
        confirmed_user_count: 0,
        created_user_count: 0,
        active_user_count: 0,
        online_user_count: 0,
        cycles_transferred: 0,
        cycles_balance: ic_cdk::api::canister_balance(),
        bytes_used: 0, // Need to wrap alloc
        timestamp: now,
        caller_id: runtime_state.env.caller(),
        wasm_memory_used: memory::used(),
    };

    for user in runtime_state.data.users.values() {
        match user {
            User::Unconfirmed(_) => response.unconfirmed_user_count += 1,
            User::Confirmed(_) => response.confirmed_user_count += 1,
            User::Created(u) => {
                response.created_user_count += 1;
                let time_since_online = now - u.last_online;
                if time_since_online < ONLINE_WINDOW_IN_MS {
                    response.online_user_count += 1;
                }
                if time_since_online < ACTIVE_WINDOW_IN_MS {
                    response.active_user_count += 1;
                }
            }
        }
    }

    response
}

#[derive(Deserialize)]
pub struct Request {}

#[derive(CandidType)]
pub struct Response {
    unconfirmed_user_count: u64,
    confirmed_user_count: u64,
    created_user_count: u64,
    active_user_count: u64,
    online_user_count: u64,
    cycles_transferred: u128,
    cycles_balance: u64,
    bytes_used: u64,
    timestamp: TimestampMillis,
    caller_id: Principal,
    wasm_memory_used: u64,
}
