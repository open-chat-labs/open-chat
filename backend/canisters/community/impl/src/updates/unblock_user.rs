use crate::activity_notifications::handle_activity_notification;
use crate::model::events::CommunityEvent;
use crate::updates::unblock_user::Response::*;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::unblock_user::*;
use ic_cdk_macros::update;
use types::UsersUnblocked;

#[update]
#[trace]
fn unblock_user(args: Args) -> Response {
    mutate_state(|state| unblock_user_impl(args, state))
}

fn unblock_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    if !state.data.is_public {
        CommunityNotPublic
    } else if let Some(caller_member) = state.data.members.get(caller) {
        if caller_member.suspended.value {
            return UserSuspended;
        }

        let unblocked_by = caller_member.user_id;
        if unblocked_by == args.user_id {
            CannotUnblockSelf
        } else if caller_member.role.can_unblock_users(&state.data.permissions) {
            let now = state.env.now();

            state.data.members.unblock(&args.user_id);

            let event = UsersUnblocked {
                user_ids: vec![args.user_id],
                unblocked_by,
            };

            state
                .data
                .events
                .push_event(CommunityEvent::UsersUnblocked(Box::new(event)), now);

            handle_activity_notification(state);

            Success
        } else {
            NotAuthorized
        }
    } else {
        UserNotInCommunity
    }
}
