use crate::model::events::GroupChatEventInternal;
use crate::updates::handle_activity_notification;
use crate::updates::unblock_user::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::unblock_user::*;
use ic_cdk_macros::update;
use types::UsersUnblocked;

#[update]
fn unblock_user(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| unblock_user_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn unblock_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if !runtime_state.data.is_public {
        GroupNotPublic
    } else if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(caller) {
        let unblocked_by = caller_participant.user_id;
        if unblocked_by == args.user_id {
            CannotUnblockSelf
        } else if caller_participant.role.can_unblock_user() {
            let now = runtime_state.env.now();

            runtime_state.data.participants.unblock(&args.user_id);

            let event = UsersUnblocked {
                user_ids: vec![args.user_id],
                unblocked_by,
            };

            runtime_state
                .data
                .events
                .push_event(GroupChatEventInternal::UsersUnblocked(event), now);

            handle_activity_notification(runtime_state);
            Success
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
