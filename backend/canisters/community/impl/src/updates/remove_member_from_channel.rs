use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};

#[update(msgpack = true)]
#[trace]
fn remove_member_from_channel(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| remove_member_from_channel_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn remove_member_from_channel_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let user_id = state.data.members.get_verified_member(caller)?.user_id;

    if state.data.members.get_by_user_id(&args.user_id).is_none() {
        return Err(OCErrorCode::TargetUserNotInCommunity.into());
    }

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    let now = state.env.now();
    channel.chat.remove_member(user_id, args.user_id, false, now)?;
    state.data.remove_user_from_channel(args.user_id, args.channel_id, now);
    handle_activity_notification(state);
    Ok(())
}
