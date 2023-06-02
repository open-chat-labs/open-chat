use crate::activity_notifications::handle_activity_notification;
use crate::updates::unblock_user::Response::*;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::unblock_user::*;
use ic_cdk_macros::update;
use types::UsersUnblocked;

#[update]
#[trace]
fn unblock_user(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| unblock_user_impl(args, state))
}

fn unblock_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if !state.data.chat.is_public {
        GroupNotPublic
    } else if let Some(caller_member) = state.data.get_member(caller) {
        if caller_member.suspended.value {
            return UserSuspended;
        }

        let unblocked_by = caller_member.user_id;
        if unblocked_by == args.user_id {
            CannotUnblockSelf
        } else if caller_member.role.can_unblock_users(&state.data.chat.permissions) {
            let now = state.env.now();

            state.data.chat.members.unblock(&args.user_id);

            let event = UsersUnblocked {
                user_ids: vec![args.user_id],
                unblocked_by,
            };

            state.data.chat.events.push_main_event(
                ChatEventInternal::UsersUnblocked(Box::new(event)),
                args.correlation_id,
                now,
            );

            handle_activity_notification(state);
            Success
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
