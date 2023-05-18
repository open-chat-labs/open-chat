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

fn unblock_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if !runtime_state.data.group_chat_core.is_public {
        GroupNotPublic
    } else if let Some(caller_member) = runtime_state.data.get_member(caller) {
        if caller_member.suspended.value {
            return UserSuspended;
        }

        let unblocked_by = caller_member.user_id;
        if unblocked_by == args.user_id {
            CannotUnblockSelf
        } else if caller_member
            .role
            .can_unblock_users(&runtime_state.data.group_chat_core.permissions)
        {
            let now = runtime_state.env.now();

            runtime_state.data.group_chat_core.members.unblock(&args.user_id);

            let event = UsersUnblocked {
                user_ids: vec![args.user_id],
                unblocked_by,
            };

            runtime_state.data.group_chat_core.events.push_main_event(
                ChatEventInternal::UsersUnblocked(Box::new(event)),
                args.correlation_id,
                now,
            );

            handle_activity_notification(runtime_state);
            Success
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
