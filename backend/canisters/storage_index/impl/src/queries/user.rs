use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use storage_index_canister::user::{Response::*, *};

#[query(candid = true, msgpack = true)]
#[trace]
fn user(_args: Args) -> Response {
    read_state(user_impl)
}

fn user_impl(state: &RuntimeState) -> Response {
    let user_id = state.env.caller();
    if let Some(user) = state.data.users.get(&user_id) {
        Success(UserRecord {
            bytes_used: user.bytes_used,
            byte_limit: user.byte_limit,
        })
    } else {
        UserNotFound
    }
}
