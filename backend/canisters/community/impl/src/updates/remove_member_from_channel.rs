use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn remove_member_from_channel(args: Args) -> Response {
    execute_update(|state| remove_member_from_channel_impl(args, state)).into()
}

fn remove_member_from_channel_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_calling_member(true)?.user_id;

    if !state.data.members.contains(&args.user_id) {
        return Err(OCErrorCode::TargetUserNotInCommunity.into());
    }

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    let bot_notification = channel.chat.remove_member(user_id, args.user_id, false, now)?;
    state.data.remove_user_from_channel(args.user_id, args.channel_id, now);
    state.push_bot_notification(bot_notification);
    handle_activity_notification(state);
    Ok(())
}
