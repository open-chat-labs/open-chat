use crate::activity_notifications::handle_activity_notification;
use crate::model::events::CommunityEventInternal;
use crate::updates::unblock_user::Response::*;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::unblock_user::*;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UsersUnblocked};

#[update(msgpack = true)]
#[trace]
fn unblock_user(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| unblock_user_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn unblock_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    if !state.data.is_public.value {
        return Err(OCErrorCode::CommunityNotPublic.into());
    }

    let caller_member = state.get_calling_member(true)?;

    if caller_member.user_id == args.user_id {
        Err(OCErrorCode::CannotBlockSelf.into())
    } else if caller_member.role().can_unblock_users(&state.data.permissions) {
        let now = state.env.now();

        state.data.members.unblock(args.user_id, now);

        let event = UsersUnblocked {
            user_ids: vec![args.user_id],
            unblocked_by: caller_member.user_id,
        };

        state
            .data
            .events
            .push_event(CommunityEventInternal::UsersUnblocked(Box::new(event)), now);

        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}
