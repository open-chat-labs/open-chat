use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::leave_channel::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};

#[update(candid = true, msgpack = true)]
#[trace]
fn leave_channel(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| leave_channel_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn leave_channel_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let Some(member) = state.data.members.get(caller) else {
        return Err(OCErrorCode::InitiatorNotInCommunity.into());
    };

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    let now = state.env.now();
    let user_id = member.user_id;

    channel.chat.leave(user_id, now)?;
    state.data.remove_user_from_channel(user_id, args.channel_id, now);
    handle_activity_notification(state);
    Ok(())
}
