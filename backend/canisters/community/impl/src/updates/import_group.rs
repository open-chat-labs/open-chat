use crate::guards::caller_is_proposals_bot;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::import_group::{Response::*, *};
use group_index_canister::c2c_start_importing_group_into_community::Response as C2cResponse;
use ic_cdk_macros::update;
use rand::Rng;
use types::{CanisterId, ChannelId, ChatId, UserId};

#[update_msgpack(guard = "caller_is_proposals_bot")]
async fn c2c_import_proposals_group(
    args: community_canister::c2c_import_proposals_group::Args,
) -> community_canister::c2c_import_proposals_group::Response {
    run_regular_jobs();

    let (group_index_canister_id, user_id) =
        read_state(|state| (state.data.group_index_canister_id, state.env.caller().into()));

    match import_group_impl(args.group_id, user_id, group_index_canister_id).await {
        Success(_) => community_canister::c2c_import_proposals_group::Response::Success,
        InternalError(error) => community_canister::c2c_import_proposals_group::Response::InternalError(error),
        response => community_canister::c2c_import_proposals_group::Response::InternalError(format!(
            "Unexpected response from 'c2c_start_importing_group_into_community': {response:?}"
        )),
    }
}

#[update]
#[trace]
async fn import_group(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        group_index_canister_id,
        user_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    import_group_impl(args.group_id, user_id, group_index_canister_id).await
}

async fn import_group_impl(group_id: ChatId, user_id: UserId, group_index_canister_id: CanisterId) -> Response {
    match group_index_canister_c2c_client::c2c_start_importing_group_into_community(
        group_index_canister_id,
        &group_index_canister::c2c_start_importing_group_into_community::Args { user_id, group_id },
    )
    .await
    {
        Ok(C2cResponse::Success(total_bytes)) => {
            mutate_state(|state| commit_group_to_import(user_id, group_id, total_bytes, false, state))
        }
        Ok(C2cResponse::UserNotInGroup) => UserNotInGroup,
        Ok(C2cResponse::NotAuthorized) => UserNotGroupOwner,
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

pub(crate) fn commit_group_to_import(
    user_id: UserId,
    group_id: ChatId,
    total_bytes: u64,
    make_default_channel: bool,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();
    let channel_id: ChannelId = state.env.rng().gen();

    if state
        .data
        .groups_being_imported
        .add(group_id, channel_id, user_id, total_bytes, now)
    {
        crate::jobs::import_groups::start_job_if_required(state);

        if make_default_channel {
            state.data.channels.add_default_channel(channel_id);
        }

        Success(SuccessResult { channel_id, total_bytes })
    } else {
        GroupAlreadyBeingImported
    }
}
