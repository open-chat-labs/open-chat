use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::mark_suspected_bot::{Response::*, *};

#[update]
#[trace]
fn mark_suspected_bot(_args: Args) -> Response {
    mutate_state(mark_suspected_bot_impl)
}

fn mark_suspected_bot_impl(runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.users.mark_suspected_bot(&runtime_state.env.caller());
    Success
}
