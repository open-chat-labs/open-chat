use crate::StorageIndexEvent;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_community::{Response::*, *};
use multi_user_canister::GroupIndexEvent;
use tracing::info;
use types::{C2CError, CanisterId, CommunityId, DeletedCommunityInfo, UserId};
use utils::cycles::accept_cycles;

#[update(msgpack = true)]
#[trace]
async fn c2c_delete_community(args: Args) -> Response {
    let PrepareResult {
        local_user_index_canister_id,
        community_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match delete_community(
        community_id,
        local_user_index_canister_id,
        args.deleted_by,
        args.community_name,
        args.members,
    )
    .await
    {
        Ok(local_user_index_canister::c2c_delete_community::Response::Success) => Success,
        Ok(local_user_index_canister::c2c_delete_community::Response::Error(error)) => Error(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    pub local_user_index_canister_id: CanisterId,
    pub community_id: CommunityId,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    let community_id = CommunityId::from(caller);

    if let Some(local_user_index_canister_id) = state.data.local_index_map.get_index_canister_for_community(&community_id) {
        let cycles = accept_cycles();
        if cycles > 0 {
            info!(cycles, %community_id, "Community refunded cycles when being deleted");
        }

        Ok(PrepareResult {
            local_user_index_canister_id,
            community_id,
        })
    } else {
        Err(CommunityNotFound)
    }
}

async fn delete_community(
    community_id: CommunityId,
    local_user_index_canister_id: CanisterId,
    deleted_by: UserId,
    community_name: String,
    members: Vec<UserId>,
) -> Result<local_user_index_canister::c2c_delete_community::Response, C2CError> {
    let response = local_user_index_canister_c2c_client::c2c_delete_community(
        local_user_index_canister_id,
        &local_user_index_canister::c2c_delete_community::Args { community_id },
    )
    .await?;

    if matches!(response, local_user_index_canister::c2c_delete_community::Response::Success) {
        mutate_state(|state| {
            commit(community_id, deleted_by, community_name, members, state);
            remove_files(community_id, state);
        });
    }

    Ok(response)
}

pub(crate) fn commit(
    community_id: CommunityId,
    deleted_by: UserId,
    name: String,
    members: Vec<UserId>,
    state: &mut RuntimeState,
) {
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

    state.data.local_index_map.mark_community_deleted(&community_id);

    let deleted_community = DeletedCommunityInfo {
        id: community_id,
        timestamp: now,
        deleted_by,
        name,
        public,
    };
    if state.data.deleted_communities.insert(deleted_community.clone()) {
        // Each member other than the deleter is told, via their canister
        state.push_event_to_users(
            members.into_iter().filter(|u| *u != deleted_by),
            GroupIndexEvent::CommunityDeleted(Box::new(deleted_community)),
            now,
        );
    }
}

// The files sent in the community name it as their only accessor, as do those sent in each group
// imported into it, so removing them removes those files. Kept apart from `commit` because queueing
// them starts sending them, which can only be done inside a canister.
pub(crate) fn remove_files(community_id: CommunityId, state: &mut RuntimeState) {
    let accessor_ids: Vec<_> = std::iter::once(community_id.into())
        .chain(state.data.deleted_groups.imported_into(community_id).map(CanisterId::from))
        .collect();
    let now = state.env.now();
    for accessor_id in accessor_ids {
        state.push_event_to_storage_index(StorageIndexEvent::RemoveAccessor(accessor_id), now);
    }
}
