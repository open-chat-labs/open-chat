use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use tracing::instrument;
use user_canister::c2c_remove_from_group::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn c2c_remove_from_group(_args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_remove_from_group_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_remove_from_group_impl(runtime_state: &mut RuntimeState) -> Response {
    let chat_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();
    runtime_state.data.group_chats.remove(chat_id, now);
    Success
}
