use crate::updates::c2c_delete_community::commit;
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::delete_uninstalled_community::{Response::*, *};
use local_user_index_canister::c2c_delete_uninstalled_community as c2c;
use tracing::info;
use types::{CanisterId, CommunityId};
use user_index_canister_c2c_client::lookup_user;

// Deletes a community whose canister has been uninstalled (eg. by the IC once it ran out of
// cycles). Such a community can't delete itself, and its list of members went with its state, so
// they aren't notified. Each of them stops seeing the community once its LocalUserIndex no
// longer knows of it.
#[update(msgpack = true)]
#[trace]
async fn delete_uninstalled_community(args: Args) -> Response {
    let community_id = args.community_id;

    let PrepareResult {
        caller,
        user_index_canister_id,
        local_user_index_canister_id,
        name,
    } = match read_state(|state| prepare(&community_id, state)) {
        Some(ok) => ok,
        None => return CommunityNotFound,
    };

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_operator => user.user_id,
        Ok(_) => return NotAuthorized,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    // The LocalUserIndex controls the canister, so it is what checks that it has been uninstalled
    match local_user_index_canister_c2c_client::c2c_delete_uninstalled_community(
        local_user_index_canister_id,
        &c2c::Args { community_id },
    )
    .await
    {
        Ok(c2c::Response::Success) => {
            mutate_state(|state| commit(community_id, user_id, name, Vec::new(), state));
            info!(%community_id, deleted_by = %user_id, "Uninstalled community deleted");
            Success
        }
        Ok(c2c::Response::CommunityNotFound) => CommunityNotFound,
        Ok(c2c::Response::CommunityNotUninstalled) => CommunityNotUninstalled,
        Ok(c2c::Response::InternalError(error)) => InternalError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    name: String,
}

fn prepare(community_id: &CommunityId, state: &RuntimeState) -> Option<PrepareResult> {
    // Only a public community's name is known here
    let name = if let Some(community) = state.data.public_communities.get(community_id) {
        community.name().to_string()
    } else if state.data.private_communities.get(community_id).is_some() {
        String::new()
    } else {
        return None;
    };

    Some(PrepareResult {
        caller: state.env.caller(),
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id: state.data.local_index_map.get_index_canister_for_community(community_id)?,
        name,
    })
}
