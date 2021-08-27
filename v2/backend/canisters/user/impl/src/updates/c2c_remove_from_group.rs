use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use user_canister::c2c_remove_from_group::{Response::*, *};

#[update]
fn c2c_remove_from_group(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_remove_from_group_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_remove_from_group_impl(runtime_state: &mut RuntimeState) -> Response {
    let group_chat_id = runtime_state.env.caller().into();
    runtime_state.data.group_chats.remove(&group_chat_id);
    Success
}
