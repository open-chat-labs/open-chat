use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users_to_channel;
use ic_cdk_macros::update;
use local_user_index_canister::invite_users_to_channel::{Response::*, *};
use types::{ChannelId, CommunityId, MessageContent, TextContent, UserId};

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn invite_users_to_channel(args: Args) -> Response {
    let invited_by = read_state(|state| state.calling_user().user_id);

    let c2c_args = community_canister::c2c_invite_users_to_channel::Args {
        caller: invited_by,
        channel_id: args.channel_id,
        user_ids: args.user_ids,
    };

    match community_canister_c2c_client::c2c_invite_users_to_channel(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            c2c_invite_users_to_channel::Response::Success(s) => {
                mutate_state(|state| {
                    commit(
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
                    commit(
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
                    users_not_in_community: r.users_not_in_community,
                })
            }
            c2c_invite_users_to_channel::Response::Failed(r) => Failed(FailedResult {
                users_not_in_community: r.users_not_in_community,
            }),
            c2c_invite_users_to_channel::Response::UserNotInCommunity => UserNotInCommunity,
            c2c_invite_users_to_channel::Response::ChannelNotFound => ChannelNotFound,
            c2c_invite_users_to_channel::Response::UserNotInChannel => UserNotInChannel,
            c2c_invite_users_to_channel::Response::NotAuthorized => NotAuthorized,
            c2c_invite_users_to_channel::Response::CommunityFrozen => CommunityFrozen,
            c2c_invite_users_to_channel::Response::TooManyInvites(l) => TooManyInvites(l),
            c2c_invite_users_to_channel::Response::UserSuspended => UserSuspended,
        },
        Err(error) => InternalError(format!("Failed to call 'community::c2c_invite_users_to_channel': {error:?}")),
    }
}

fn commit(
    invited_by: UserId,
    community_id: CommunityId,
    community_name: String,
    channel_id: ChannelId,
    channel_name: String,
    invited_users: Vec<UserId>,
    state: &mut RuntimeState,
) {
    let text = format!(
        "You have been invited to the channel [{channel_name}](/community/{community_id}/channel/{channel_id}) in the community [{community_name}](/community/{community_id}) by @UserId({invited_by})."
    );
    let message = MessageContent::Text(TextContent { text });

    for user_id in invited_users {
        state.push_oc_bot_message_to_user(user_id, message.clone());
    }

    crate::jobs::sync_events_to_user_canisters::start_job_if_required(state);
    crate::jobs::sync_events_to_user_index_canister::start_job_if_required(state);
}
