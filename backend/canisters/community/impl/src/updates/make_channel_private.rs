use crate::{activity_notifications::handle_activity_notification, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::make_channel_private::{Response::*, *};
use group_chat_core::MakePrivateResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn make_channel_private(args: Args) -> Response {
    mutate_state(|state| make_channel_private_impl(args, state))
}

fn make_channel_private_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(member) = state.data.members.get(state.env.caller()) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            match channel.chat.make_private(member.user_id, state.env.now()) {
                MakePrivateResult::Success => {
                    handle_activity_notification(state);
                    Success
                }
                MakePrivateResult::UserSuspended => UserSuspended,
                MakePrivateResult::UserNotInGroup => UserNotInChannel,
                MakePrivateResult::NotAuthorized => NotAuthorized,
                MakePrivateResult::AlreadyPrivate => AlreadyPrivate,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
