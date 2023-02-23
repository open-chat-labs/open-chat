use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::query;
use storage_index_canister::user::{Response::*, *};

#[query]
#[trace]
fn user(_args: Args) -> Response {
    read_state(user_impl)
}

fn user_impl(runtime_state: &RuntimeState) -> Response {
    let user_id = runtime_state.env.caller();
    if let Some(user) = runtime_state.data.users.get(&user_id) {
        Success(UserRecord {
            bytes_used: user.bytes_used,
            byte_limit: user.byte_limit,
        })
    } else {
        UserNotFound
    }
}
