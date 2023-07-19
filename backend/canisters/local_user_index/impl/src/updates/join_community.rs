use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::join_community::{Response::*, *};
use types::{CommunityId, UserId};
use user_canister::Event as UserEvent;
use user_index_canister::Event as UserIndexEvent;

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn join_community(args: Args) -> Response {
    let user_details = read_state(user_details);

    let c2c_args = community_canister::c2c_join_community::Args {
        user_id: user_details.user_id,
        principal: user_details.principal,
        invite_code: args.invite_code,
        is_platform_moderator: user_details.is_platform_moderator,
    };
    match community_canister_c2c_client::c2c_join_community(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            community_canister::c2c_join_community::Response::Success(s) => {
                mutate_state(|state| notify_user_joined_community(user_details.user_id, args.community_id, state));
                Success(s)
            }
            community_canister::c2c_join_community::Response::AlreadyInCommunity(s) => {
                mutate_state(|state| notify_user_joined_community(user_details.user_id, args.community_id, state));
                AlreadyInCommunity(s)
            }
            community_canister::c2c_join_community::Response::GateCheckFailed(msg) => GateCheckFailed(msg),
            community_canister::c2c_join_community::Response::NotInvited => NotInvited,
            community_canister::c2c_join_community::Response::UserBlocked => UserBlocked,
            community_canister::c2c_join_community::Response::MemberLimitReached(l) => MemberLimitReached(l),
            community_canister::c2c_join_community::Response::CommunityFrozen => CommunityFrozen,
            community_canister::c2c_join_community::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("Failed to call 'community::c2c_join_community': {error:?}")),
    }
}

struct UserDetails {
    user_id: UserId,
    principal: Principal,
    is_platform_moderator: bool,
}

fn user_details(state: &RuntimeState) -> UserDetails {
    let user = state.calling_user();

    UserDetails {
        user_id: user.user_id,
        principal: user.principal,
        is_platform_moderator: user.is_platform_moderator,
    }
}

pub(crate) fn notify_user_joined_community(user_id: UserId, community_id: CommunityId, state: &mut RuntimeState) {
    if state.data.local_users.get(&user_id).is_some() {
        state.push_event_to_user(
            user_id,
            UserEvent::UserJoinedCommunity(Box::new(user_canister::UserJoinedCommunity { community_id })),
        );
    } else {
        state.push_event_to_user_index(UserIndexEvent::UserJoinedCommunity(Box::new(
            user_index_canister::UserJoinedCommunity { user_id, community_id },
        )));
    }
}
