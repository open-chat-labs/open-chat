use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use user_canister::handle_add_to_group_requested::{Response::*, *};

#[update]
fn handle_add_to_group_requested(args: Args) -> Response {
    RUNTIME_STATE.with(|state| handle_add_to_group_requested_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn handle_add_to_group_requested_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.blocked_users.contains(&args.added_by) {
        Blocked
    } else {
        let group_chat_id = runtime_state.env.caller().into();
        runtime_state.data.group_chats.add(group_chat_id);
        Success(SuccessResult {
            principal: runtime_state.data.owner,
        })
    }
}
