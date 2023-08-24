use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::join_channel::{Response::*, *};

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn join_channel(args: Args) -> Response {
    let user_details = read_state(|state| state.calling_user());

    let c2c_args = community_canister::c2c_join_channel::Args {
        user_id: user_details.user_id,
        principal: user_details.principal,
        channel_id: args.channel_id,
        invite_code: args.invite_code,
        is_platform_moderator: user_details.is_platform_moderator,
        is_bot: user_details.is_bot,
    };
    match community_canister_c2c_client::c2c_join_channel(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            community_canister::c2c_join_channel::Response::Success(s) => {
                mutate_state(|state| state.notify_user_joined_channel(user_details.user_id, args.community_id, &s));
                Success(s)
            }
            community_canister::c2c_join_channel::Response::SuccessJoinedCommunity(s) => {
                mutate_state(|state| state.notify_user_joined_community(user_details.user_id, &s));
                SuccessJoinedCommunity(s)
            }
            community_canister::c2c_join_channel::Response::AlreadyInChannel(s) => AlreadyInChannel(s),
            community_canister::c2c_join_channel::Response::GateCheckFailed(msg) => GateCheckFailed(msg),
            community_canister::c2c_join_channel::Response::UserNotInCommunity => CommunityNotPublic,
            community_canister::c2c_join_channel::Response::ChannelNotFound => ChannelNotFound,
            community_canister::c2c_join_channel::Response::UserSuspended => UserSuspended,
            community_canister::c2c_join_channel::Response::UserBlocked => UserBlocked,
            community_canister::c2c_join_channel::Response::MemberLimitReached(l) => MemberLimitReached(l),
            community_canister::c2c_join_channel::Response::CommunityFrozen => CommunityFrozen,
            community_canister::c2c_join_channel::Response::NotInvited => NotInvited,
            community_canister::c2c_join_channel::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("Failed to call 'community::c2c_join_channel': {error:?}")),
    }
}
