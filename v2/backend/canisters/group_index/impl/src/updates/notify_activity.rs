use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::updates::notify_activity::{Response::*, *};
use ic_cdk_macros::update;
use shared::types::chat_id::GroupChatId;

#[update]
fn notify_activity(_: Args) -> Response {
    RUNTIME_STATE.with(|state| notify_activity_impl(state.borrow_mut().as_mut().unwrap()))
}

fn notify_activity_impl(runtime_state: &mut RuntimeState) -> Response {
    let chat_id = GroupChatId::from(runtime_state.env.caller());
    let now = runtime_state.env.now();

    if let Some(g) = runtime_state.data.private_groups.get_mut(&chat_id) {
        g.notify_activity(now);
    } else if let Some(g) = runtime_state.data.public_groups.get_mut(&chat_id) {
        g.notify_activity(now);
    } else {
        return ChatNotFound;
    }
    Success
}
