use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users_to_channel::{Response::*, *};
use group_chat_core::InvitedUsersResult;

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
fn c2c_invite_users_to_channel(args: Args) -> Response {
    mutate_state(|state| c2c_invite_users_to_channel_impl(args, state))
}

fn c2c_invite_users_to_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(member) = state.data.members.get_by_user_id(&args.caller) {
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
                    if users_not_in_community.is_empty() {
                        Success(SuccessResult {
                            invited_users: result.invited_users,
                            community_name: state.data.name.clone(),
                            channel_name: channel.chat.name.clone(),
                        })
                    } else {
                        PartialSuccess(PartialSuccessResult {
                            invited_users: result.invited_users,
                            community_name: state.data.name.clone(),
                            channel_name: channel.chat.name.clone(),
                            users_not_in_community,
                        })
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

// #[allow(clippy::too_many_arguments)]
// fn send_oc_bot_message_to_each_user(
//     invited_by: UserId,
//     user_ids: Vec<UserId>,
//     community_id: CommunityId,
//     channel_id: ChannelId,
//     community_name: String,
//     channel_name: String,
//     local_user_index: CanisterId,
//     fire_and_forget_handler: &mut FireAndForgetHandler,
// ) {
//     let text = format!("You have been invited to the channel [{channel_name}](/community/{community_id}/channel/{channel_id}) in the community [{community_name}](/community/{community_id}) by @UserId({invited_by}).");
//     let message = MessageContent::Text(TextContent { text });

//     let args = c2c_notify_events::Args {
//         events: user_ids
//             .into_iter()
//             .map(|user_id| {
//                 Event::OpenChatBotMessage(OpenChatBotMessage {
//                     user_id,
//                     message: message.clone(),
//                 })
//             })
//             .collect(),
//     };

//     fire_and_forget_handler.send(
//         local_user_index,
//         "c2c_notify_events_msgpack".to_string(),
//         serialize_then_unwrap(args),
//     );
// }
