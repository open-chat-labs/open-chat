use crate::guards::caller_is_proposals_bot;
use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::import_group::{Response::*, *};
use group_index_canister::c2c_start_importing_group_into_community::Response as C2cResponse;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, ChannelId, ChatId, OCResult, UserId};

#[update(guard = "caller_is_proposals_bot", msgpack = true)]
async fn c2c_import_proposals_group(
    args: community_canister::c2c_import_proposals_group::Args,
) -> community_canister::c2c_import_proposals_group::Response {
    run_regular_jobs();

    let (group_index_canister_id, user_id) =
        read_state(|state| (state.data.group_index_canister_id, state.env.caller().into()));

    match import_group_impl(args.group_id, user_id, group_index_canister_id).await {
        Success(result) => community_canister::c2c_import_proposals_group::Response::Success(result.channel_id),
        Error(error) => community_canister::c2c_import_proposals_group::Response::Error(error),
    }
}

#[update(msgpack = true)]
#[trace]
async fn import_group(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        group_index_canister_id,
        user_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
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
        Ok(C2cResponse::Success(total_bytes)) => mutate_state(|state| {
            let channel_id = state.generate_channel_id();
            commit_group_to_import(user_id, group_id, channel_id, total_bytes, false, state)
        }),
        Ok(C2cResponse::Error(error)) => Error(error),
        Ok(response) => Error(OCErrorCode::Unknown.with_json(&response)),
        Err(error) => Error(error.into()),
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    user_id: UserId,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    let member = state.get_calling_member(true)?;
    if member.role().is_owner() {
        if !state.data.groups_being_imported.contains(&args.group_id) {
            Ok(PrepareResult {
                group_index_canister_id: state.data.group_index_canister_id,
                user_id: member.user_id,
            })
        } else {
            Err(OCErrorCode::GroupAlreadyBeingImported.into())
        }
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}

pub(crate) fn commit_group_to_import(
    user_id: UserId,
    group_id: ChatId,
    channel_id: ChannelId,
    total_bytes: u64,
    make_default_channel: bool,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();

    if state
        .data
        .groups_being_imported
        .add(group_id, channel_id, user_id, total_bytes, now, make_default_channel)
    {
        crate::jobs::import_groups::start_job_if_required(state);

        Success(SuccessResult { channel_id, total_bytes })
    } else {
        Error(OCErrorCode::NoChange.into())
    }
}
