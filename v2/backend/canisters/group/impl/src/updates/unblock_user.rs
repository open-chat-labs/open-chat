use crate::updates::handle_activity_notification;
use crate::updates::unblock_user::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::unblock_user::*;
use ic_cdk_macros::update;

#[update]
fn unblock_user(args: Args) -> Response {
    RUNTIME_STATE.with(|state| unblock_user_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn unblock_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if !runtime_state.data.is_public {
        GroupNotPublic
    } else if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(caller) {
        if caller_participant.user_id == args.user_id {
            CannotUnblockSelf
        } else if caller_participant.role.can_unblock_user() {
            runtime_state.data.participants.unblock(&args.user_id);
            handle_activity_notification();
            Success
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
