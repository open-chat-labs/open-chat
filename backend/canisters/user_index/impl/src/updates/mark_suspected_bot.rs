use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_index_canister::mark_suspected_bot::*;

#[update(msgpack = true)]
#[trace]
fn mark_suspected_bot(_args: Args) -> Response {
    mutate_state(mark_suspected_bot_impl)
}

fn mark_suspected_bot_impl(state: &mut RuntimeState) -> Response {
    state.data.users.mark_suspected_bot(&state.env.caller());
    Response::Success
}
