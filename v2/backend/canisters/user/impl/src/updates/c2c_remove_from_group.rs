use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use tracing::instrument;
use user_canister::c2c_remove_from_group::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn c2c_remove_from_group(_args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| c2c_remove_from_group_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_remove_from_group_impl(runtime_state: &mut RuntimeState) -> Response {
    let chat_id = runtime_state.env.caller().into();
    runtime_state.data.group_chats.remove(&chat_id);
    Success
}
