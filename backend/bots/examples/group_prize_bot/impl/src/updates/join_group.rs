use crate::guards::caller_is_admin;
use crate::mutate_state;
use canister_tracing_macros::trace;
use group_prize_bot::join_group::{Response::*, *};
use ic_cdk_macros::update;
use tracing::error;
use types::CanisterId;

#[update(guard = "caller_is_admin")]
#[trace]
async fn join_group(args: Args) -> Response {
    if !args.add_only {
        // 1. Lookup the local_user_index for the given group
        let group = args.group;
        let local_user_index_canister = match lookup_local_user_index(group).await {
            Ok(id) => id,
            Err(response) => return response,
        };

        // 2. Call the local_user_index to join the group
        if let Err(response) = call_join_group(group, local_user_index_canister).await {
            return response;
        }
    }

    // 3. Update the groups set locally
    mutate_state(|state| {
        state.data.groups.insert(args.group);
    });

    Success
}

async fn lookup_local_user_index(group: CanisterId) -> Result<CanisterId, Response> {
    let c2c_args = group_canister::local_user_index::Args {};
    match group_canister_c2c_client::local_user_index(group, &c2c_args).await {
        Ok(group_canister::local_user_index::Response::Success(canister_id)) => Ok(canister_id),
        Err(error) => {
            error!(?error, ?group, "Group not found");
            Err(GroupNotFound)
        }
    }
}

async fn call_join_group(group: CanisterId, local_user_index: CanisterId) -> Result<(), Response> {
    let c2c_args = local_user_index_canister::join_group::Args {
        chat_id: group.into(),
        invite_code: None,
        correlation_id: 0,
    };

    match local_user_index_canister_c2c_client::join_group(local_user_index, &c2c_args).await {
        Ok(result) => match result {
            local_user_index_canister::join_group::Response::Success(_) => Ok(()),
            local_user_index_canister::join_group::Response::AlreadyInGroup
            | local_user_index_canister::join_group::Response::AlreadyInGroupV2(_) => Err(AlreadyInGroup),
            local_user_index_canister::join_group::Response::FailedToPassGateCheck(msg) => Err(FailedToPassGateCheck(msg)),
            local_user_index_canister::join_group::Response::GroupNotFound => Err(GroupNotFound),
            local_user_index_canister::join_group::Response::GroupNotPublic => Err(GroupNotPublic),
            local_user_index_canister::join_group::Response::ParticipantLimitReached(_) => Err(ParticipantLimitReached),
            local_user_index_canister::join_group::Response::Blocked => Err(Blocked),
            local_user_index_canister::join_group::Response::UserSuspended => Err(UserSuspended),
            local_user_index_canister::join_group::Response::ChatFrozen => Err(ChatFrozen),
            local_user_index_canister::join_group::Response::InternalError(m) => Err(InternalError(m)),
        },
        Err(error) => {
            let error_message = format!("{error:?}");
            error!(?error_message, ?group, "Failed to join group");
            Err(InternalError(error_message))
        }
    }
}
