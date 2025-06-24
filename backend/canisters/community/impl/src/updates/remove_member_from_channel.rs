use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, execute_update, guards::caller_is_local_user_index,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::*;
use oc_error_codes::OCErrorCode;
use types::{BotCaller, BotPermissions, Caller, ChannelId, ChatPermission, OCResult, UnitResult, UserId};

#[update(msgpack = true)]
#[trace]
fn remove_member_from_channel(args: Args) -> Response {
    execute_update(|state| remove_member_from_channel_impl(args.channel_id, args.user_id, None, state)).into()
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_bot_remove_user_from_channel(args: community_canister::c2c_bot_remove_user_from_channel::Args) -> UnitResult {
    execute_update(|state| {
        let bot_caller = BotCaller {
            bot: args.bot_id,
            initiator: args.initiator.clone(),
        };

        if !state.data.is_bot_permitted(
            &bot_caller.bot,
            Some(args.channel_id),
            &bot_caller.initiator,
            &BotPermissions::from_chat_permission(ChatPermission::RemoveMembers),
        ) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }

        remove_member_from_channel_impl(args.channel_id, args.user_id, Some(Caller::BotV2(bot_caller)), state)
    })
    .into()
}

fn remove_member_from_channel_impl(
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
