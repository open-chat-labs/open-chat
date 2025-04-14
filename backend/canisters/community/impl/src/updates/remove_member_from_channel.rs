use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

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

fn remove_member_from_channel_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_and_verify_calling_member()?.user_id;

    if !state.data.members.contains(&args.user_id) {
        return Err(OCErrorCode::TargetUserNotInCommunity.into());
    }

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    channel.chat.remove_member(user_id, args.user_id, false, now)?;
    state.data.remove_user_from_channel(args.user_id, args.channel_id, now);
    handle_activity_notification(state);
    Ok(())
}
