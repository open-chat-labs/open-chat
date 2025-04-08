use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::cancel_invites::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};

#[update(msgpack = true)]
#[trace]
fn cancel_invites(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| cancel_invites_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn cancel_invites_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let member = state.data.members.get_then_verify(caller)?;
    let now = state.env.now();

    if let Some(channel_id) = args.channel_id {
        let Some(channel) = state.data.channels.get_mut(&channel_id) else {
            return Err(OCErrorCode::ChatNotFound.into());
        };

        channel.chat.cancel_invites(member.user_id, args.user_ids, now)?;
    } else {
        if !member.role().can_invite_users(&state.data.permissions) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }

        for user_id in args.user_ids {
            if state.data.invited_users.remove(&user_id, now).is_some() {
                for channel in state.data.channels.iter_mut() {
                    channel.chat.cancel_invite_unchecked(&user_id, now);
                }
            }
        }
    }

    handle_activity_notification(state);
    Ok(())
}
