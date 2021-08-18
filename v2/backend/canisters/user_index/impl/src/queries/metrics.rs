use crate::model::user::User;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use shared::memory;
use user_index_canister::metrics::*;

const ONLINE_WINDOW_IN_MS: u64 = 2 * 60 * 1000; // 2 minutes
const ACTIVE_WINDOW_IN_MS: u64 = 7 * 24 * 60 * 60 * 1000; // 1 week

#[query]
fn metrics(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| metrics_impl(state.borrow().as_ref().unwrap()))
}

fn metrics_impl(runtime_state: &RuntimeState) -> Response {
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
