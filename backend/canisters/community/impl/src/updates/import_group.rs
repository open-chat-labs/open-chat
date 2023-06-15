use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::import_group::{Response::*, *};
use group_index_canister::c2c_start_importing_group_into_community::Response as C2cResponse;
use ic_cdk_macros::update;
use rand::Rng;
use types::{CanisterId, ChannelId, ChatId, UserId};

#[update]
#[trace]
async fn import_group(args: Args) -> Response {
    let PrepareResult {
        group_index_canister_id,
        user_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match group_index_canister_c2c_client::c2c_start_importing_group_into_community(
        group_index_canister_id,
        &group_index_canister::c2c_start_importing_group_into_community::Args {
            user_id,
            group_id: args.group_id,
        },
    )
    .await
    {
        Ok(C2cResponse::Success(total_bytes)) => mutate_state(|state| commit(user_id, args.group_id, total_bytes, state)),
        Ok(C2cResponse::UserNotInGroup) => UserNotInGroup,
        Ok(C2cResponse::UserNotGroupOwner) => UserNotGroupOwner,
        Ok(C2cResponse::UserSuspended) => UserSuspended,
        Ok(C2cResponse::GroupNotFound) => GroupNotFound,
        Ok(C2cResponse::AlreadyImportingToAnotherCommunity) => GroupImportingToAnotherCommunity,
        Ok(C2cResponse::ChatFrozen) => GroupFrozen,
        Ok(C2cResponse::InternalError(error)) => InternalError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    user_id: UserId,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.role.is_owner() {
            if !state.data.groups_being_imported.contains(&args.group_id) {
                Ok(PrepareResult {
                    group_index_canister_id: state.data.group_index_canister_id,
                    user_id: member.user_id,
                })
            } else {
                Err(GroupAlreadyBeingImported)
            }
        } else {
            Err(UserNotCommunityOwner)
        }
    } else {
        Err(UserNotInCommunity)
    }
}

fn commit(user_id: UserId, group_id: ChatId, total_bytes: u64, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let channel_id: ChannelId = state.env.rng().gen();

    if state
        .data
        .groups_being_imported
        .add(group_id, channel_id, user_id, total_bytes, now)
    {
        crate::jobs::import_groups::start_job_if_required(state);
        Success(SuccessResult { channel_id, total_bytes })
    } else {
        GroupAlreadyBeingImported
    }
}
