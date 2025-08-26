use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users_to_channel;
use local_user_index_canister::invite_users_to_channel::{Response::*, *};
use types::{ChannelId, CommunityId, MessageContent, TextContent, UserId};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn invite_users_to_channel(args: Args) -> Response {
    let (invited_by, users) = read_state(|state| {
        let users = args
            .user_ids
            .iter()
            .flat_map(|u| state.data.global_users.get_by_user_id(u))
            .map(|u| (u.user_id, u.principal))
            .collect();

        (state.calling_user_id(), users)
    });

    let c2c_args = c2c_invite_users_to_channel::Args {
        caller: invited_by,
        channel_id: args.channel_id,
        users,
    };

    match community_canister_c2c_client::c2c_invite_users_to_channel(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            c2c_invite_users_to_channel::Response::Success(s) => {
                mutate_state(|state| {
                    send_channel_invitation(
                        invited_by,
                        args.community_id,
                        s.community_name,
                        args.channel_id,
                        s.channel_name,
                        s.invited_users,
                        state,
                    );
                });
                Success
            }
            c2c_invite_users_to_channel::Response::PartialSuccess(r) => {
                mutate_state(|state| {
                    send_channel_invitation(
                        invited_by,
                        args.community_id,
                        r.community_name,
                        args.channel_id,
                        r.channel_name,
                        r.invited_users,
                        state,
                    );
                });
                PartialSuccess(PartialSuccessResult {
                    failed_users: r.failed_users,
                })
            }
            c2c_invite_users_to_channel::Response::Failed(r) => Failed(FailedResult {
                failed_users: r.failed_users,
            }),
            c2c_invite_users_to_channel::Response::Error(error) => Error(error),
        },
        Err(error) => InternalError(format!("Failed to call 'community::c2c_invite_users_to_channel': {error:?}")),
    }
}

pub(crate) fn send_channel_invitation(
    invited_by: UserId,
    community_id: CommunityId,
    community_name: String,
    channel_id: ChannelId,
    channel_name: String,
    invited_users: Vec<UserId>,
    state: &mut RuntimeState,
) {
    let now = state.env.now();
    let text = format!(
        "You have been invited to the channel [{channel_name}](/community/{community_id}/channel/{channel_id}) in the community [{community_name}](/community/{community_id}) by @UserId({invited_by})."
    );
    let message = MessageContent::Text(TextContent { text });

    for user_id in invited_users {
        state.push_oc_bot_message_to_user(user_id, message.clone(), now);
    }
}
