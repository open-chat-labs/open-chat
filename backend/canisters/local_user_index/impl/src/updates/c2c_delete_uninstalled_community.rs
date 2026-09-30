use crate::guards::caller_is_group_index;
use crate::updates::c2c_delete_group::spawn_delete_canister;
use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_delete_uninstalled_community::{Response::*, *};
use types::CanisterId;

// Deletes a community whose canister has been uninstalled (eg. by the IC once it ran out of
// cycles). Its state is gone and it has no code with which to delete itself, so it is deleted
// here, but only after checking that the canister really is empty.
#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
async fn c2c_delete_uninstalled_community(args: Args) -> Response {
    let community_id = args.community_id;
    let canister_id = CanisterId::from(community_id);

    if !read_state(|state| state.data.local_communities.contains(&community_id)) {
        return CommunityNotFound;
    }

    match utils::canister::canister_status(canister_id).await {
        Ok(status) if status.module_hash.is_none() => {}
        Ok(_) => return CommunityNotUninstalled,
        Err(error) => return InternalError(format!("{error:?}")),
    }

    mutate_state(|state| {
        if state.data.local_communities.delete(&community_id) {
            state.data.communities_requiring_upgrade.remove_failed(&canister_id);
            spawn_delete_canister(canister_id);
            Success
        } else {
            CommunityNotFound
        }
    })
}
