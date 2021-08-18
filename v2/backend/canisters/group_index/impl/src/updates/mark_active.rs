use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::mark_active::{Response::*, *};
use ic_cdk_macros::update;
use types::GroupChatId;

#[update]
fn mark_active(args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_active_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_active_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let chat_id = GroupChatId::from(runtime_state.env.caller());
    let now = runtime_state.env.now();

    if let Some(g) = runtime_state.data.private_groups.get_mut(&chat_id) {
        g.mark_active(now + args.duration);
    } else if let Some(g) = runtime_state.data.public_groups.get_mut(&chat_id) {
        g.mark_active(now + args.duration);
    } else {
        return ChatNotFound;
    }
    Success
}
