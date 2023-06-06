use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::invite_users_to_channel::{Response::*, *};
use fire_and_forget_handler::FireAndForgetHandler;
use group_chat_core::InvitedUsersResult;
use ic_cdk_macros::update;
use local_user_index_canister::{c2c_notify_events, Event, OpenChatBotMessage};
use msgpack::serialize_then_unwrap;
use types::{CanisterId, ChannelId, CommunityId, MessageContent, TextContent, UserId};

#[update]
#[trace]
fn invite_users_to_channel(args: Args) -> Response {
    mutate_state(|state| invite_users_to_channel_impl(args, state))
}

fn invite_users_to_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let (users_to_invite, users_not_in_community): (Vec<_>, Vec<_>) = args
            .user_ids
            .iter()
            .copied()
            .partition(|id| state.data.members.get_by_user_id(id).is_some());

        if users_to_invite.is_empty() {
            return Failed(FailedResult { users_not_in_community });
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            match channel.chat.invite_users(member.user_id, users_to_invite, now) {
                InvitedUsersResult::Success(result) => {
                    // Single fire and forget call to local_user_index to send bot message to each user
                    send_oc_bot_message_to_each_user(
                        member.user_id,
                        result.invited_users,
                        state.env.canister_id().into(),
                        args.channel_id,
                        state.data.name.clone(),
                        result.group_name,
                        state.data.local_user_index_canister_id,
                        &mut state.data.fire_and_forget_handler,
                    );

                    if users_not_in_community.is_empty() {
                        Success
                    } else {
                        PartialSuccess(PartialSuccessResult { users_not_in_community })
                    }
                }
                InvitedUsersResult::UserNotInGroup => UserNotInChannel,
                InvitedUsersResult::NotAuthorized => NotAuthorized,
                InvitedUsersResult::UserSuspended => UserSuspended,
                InvitedUsersResult::TooManyInvites(v) => TooManyInvites(v),
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}

#[allow(clippy::too_many_arguments)]
fn send_oc_bot_message_to_each_user(
    invited_by: UserId,
    user_ids: Vec<UserId>,
    community_id: CommunityId,
    channel_id: ChannelId,
    community_name: String,
    channel_name: String,
    local_user_index: CanisterId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let text = format!("You have been invited to the channel [{channel_name}](/community/{community_id}/channel/{channel_id}) in the community [{community_name}](/community/{community_id}) by @UserId({invited_by}).");
    let message = MessageContent::Text(TextContent { text });

    let args = c2c_notify_events::Args {
        events: user_ids
            .into_iter()
            .map(|user_id| {
                Event::OpenChatBotMessage(OpenChatBotMessage {
                    user_id,
                    message: message.clone(),
                })
            })
            .collect(),
    };

    fire_and_forget_handler.send(
        local_user_index,
        "c2c_notify_events_msgpack".to_string(),
        serialize_then_unwrap(args),
    );
}
