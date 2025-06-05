use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::unblock_user::*;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UsersUnblocked};

#[update(msgpack = true)]
#[trace]
fn unblock_user(args: Args) -> Response {
    execute_update(|state| unblock_user_impl(args, state)).into()
}

fn unblock_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    if !state.data.chat.is_public.value {
        Err(OCErrorCode::ChatNotPublic.into())
    } else {
        let caller_member = state.get_calling_member(true)?;
        if caller_member.user_id() == args.user_id {
            Err(OCErrorCode::CannotBlockSelf.into())
        } else if caller_member.role().can_unblock_users(&state.data.chat.permissions) {
            let now = state.env.now();

            state.data.chat.members.unblock(args.user_id, now);

            let event = UsersUnblocked {
                user_ids: vec![args.user_id],
                unblocked_by: caller_member.user_id(),
            };

            state
                .data
                .chat
                .events
                .push_main_event(ChatEventInternal::UsersUnblocked(Box::new(event)), now);

            handle_activity_notification(state);
            Ok(())
        } else {
            Err(OCErrorCode::InitiatorNotAuthorized.into())
        }
    }
}
