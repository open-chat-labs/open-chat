use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_community::{Response::*, *};
use ic_cdk::api::call::CallResult;
use types::{CanisterId, CommunityId, DeletedCommunityInfo, UserId};

#[update_msgpack]
#[trace]
async fn c2c_delete_community(args: Args) -> Response {
    let PrepareResult {
        local_group_index_canister_id,
        community_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match delete_community(
        community_id,
        local_group_index_canister_id,
        args.deleted_by,
        args.community_name,
        args.members,
    )
    .await
    {
        Ok(local_group_index_canister::c2c_delete_community::Response::Success) => Success,
        Ok(local_group_index_canister::c2c_delete_community::Response::CommunityNotFound) => CommunityNotFound,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    pub local_group_index_canister_id: CanisterId,
    pub community_id: CommunityId,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    let community_id = CommunityId::from(caller);

    if let Some(local_group_index_canister_id) = state.data.local_index_map.get_index_canister_for_community(&community_id) {
        Ok(PrepareResult {
            local_group_index_canister_id,
            community_id,
        })
    } else {
        Err(CommunityNotFound)
    }
}

pub(crate) async fn delete_community(
    community_id: CommunityId,
    local_group_index_canister_id: CanisterId,
    deleted_by: UserId,
    community_name: String,
    members: Vec<UserId>,
) -> CallResult<local_group_index_canister::c2c_delete_community::Response> {
    let response = local_group_index_canister_c2c_client::c2c_delete_community(
        local_group_index_canister_id,
        &local_group_index_canister::c2c_delete_community::Args { community_id },
    )
    .await?;

    if matches!(response, local_group_index_canister::c2c_delete_community::Response::Success) {
        mutate_state(|state| commit(community_id, deleted_by, community_name, members, state));
    }

    Ok(response)
}

fn commit(community_id: CommunityId, deleted_by: UserId, name: String, members: Vec<UserId>, state: &mut RuntimeState) {
    let now = state.env.now();

    let public = if let Some(community) = state.data.public_communities.delete(&community_id) {
        state
            .data
            .public_group_and_community_names
            .remove(community.name(), community_id.into());
        true
    } else {
        state.data.private_communities.delete(&community_id);
        false
    };

    state.data.deleted_communities.insert(
        DeletedCommunityInfo {
            id: community_id,
            timestamp: now,
            deleted_by,
            name,
            public,
        },
        members,
    );
    crate::jobs::push_community_deleted_notifications::start_job_if_required(state);
}
