use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::invite_users_to_community::{Response::*, *};
use types::{CommunityId, MessageContent, TextContent, UserId};

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn invite_users_to_community(args: Args) -> Response {
    let PrepareResult { invited_by, users } = read_state(|state| prepare(&args, state));

    let c2c_args = community_canister::c2c_invite_users::Args {
        caller: invited_by,
        users,
        channel: args.channel,
    };

    match community_canister_c2c_client::c2c_invite_users(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            community_canister::c2c_invite_users::Response::Success(s) => {
                mutate_state(|state| {
                    commit(invited_by, args.community_id, s.community_name, s.invited_users, state);
                });
                Success
            }
            community_canister::c2c_invite_users::Response::UserNotInCommunity => UserNotInCommunity,
            community_canister::c2c_invite_users::Response::NotAuthorized => NotAuthorized,
            community_canister::c2c_invite_users::Response::CommunityFrozen => CommunityFrozen,
            community_canister::c2c_invite_users::Response::TooManyInvites(l) => TooManyInvites(l),
            community_canister::c2c_invite_users::Response::UserSuspended => UserSuspended,
        },
        Err(error) => InternalError(format!("Failed to call 'community::c2c_invite_users': {error:?}")),
    }
}

struct PrepareResult {
    invited_by: UserId,
    users: Vec<(UserId, Principal)>,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> PrepareResult {
    let caller = runtime_state.env.caller();
    let invited_by = runtime_state.data.global_users.get(&caller).unwrap().user_id;
    let users = args
        .user_ids
        .iter()
        .filter_map(|user_id| runtime_state.data.global_users.get(&(*user_id).into()))
        .map(|user| (user.user_id, user.principal))
        .collect();
    PrepareResult { invited_by, users }
}

fn commit(
    invited_by: UserId,
    community_id: CommunityId,
    community_name: String,
    invited_users: Vec<UserId>,
    runtime_state: &mut RuntimeState,
) {
    let text = format!(
        "You have been invited to the community [{community_name}](/community/{community_id}) by @UserId({invited_by})."
    );
    let message = MessageContent::Text(TextContent { text });

    for user_id in invited_users {
        runtime_state.push_oc_bot_message_to_user(user_id, message.clone());
    }

    crate::jobs::sync_events_to_user_canisters::start_job_if_required(runtime_state);
    crate::jobs::sync_events_to_user_index_canister::start_job_if_required(runtime_state);
}
