use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::*;
use oc_error_codes::OCErrorCode;
use types::{Caller, ChannelId, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
fn remove_member_from_channel(args: Args) -> Response {
    execute_update(|state| remove_member_from_channel_impl(args.channel_id, args.user_id, None, state)).into()
}

pub(crate) fn remove_member_from_channel_impl(
    channel_id: ChannelId,
    user_id: UserId,
    ext_caller: Option<Caller>,
    state: &mut RuntimeState,
) -> OCResult {
    state.data.verify_not_frozen()?;

    let caller = state.verified_caller(ext_caller)?;

    if !state.data.members.contains(&user_id) {
        return Err(OCErrorCode::TargetUserNotInCommunity.into());
    }

    let channel = state.data.channels.get_mut_or_err(&channel_id)?;
    let now = state.env.now();

    let bot_notification = channel.chat.remove_member(caller, user_id, false, now)?;
    state.data.remove_user_from_channel(user_id, channel_id, now);
    state.push_bot_notification(bot_notification);
    handle_activity_notification(state);
    Ok(())
}
