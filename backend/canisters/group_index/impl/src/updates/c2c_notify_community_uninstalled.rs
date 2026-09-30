use crate::updates::c2c_delete_community::delete_community;
use crate::{RuntimeState, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use group_index_canister::c2c_notify_community_uninstalled::*;
use oc_error_codes::{OCError, OCErrorCode};
use tracing::info;
use types::{CanisterId, CommunityId, UnitResult};

// Called by a LocalUserIndex on finding that one of its communities' canisters has been
// uninstalled (eg. by the IC once it ran out of cycles). The community's state went with its
// code, so it can't delete itself and is deleted here instead. Its list of members is gone too,
// so they aren't notified. Each of them stops seeing the community once its LocalUserIndex no
// longer knows of it.
#[update(msgpack = true)]
#[trace]
async fn c2c_notify_community_uninstalled(args: Args) -> Response {
    let community_id = args.community_id;

    let PrepareResult {
        local_user_index_canister_id,
        name,
    } = match read_state(|state| prepare(&community_id, state)) {
        Ok(ok) => ok,
        Err(error) => return UnitResult::Error(error),
    };

    match delete_community(
        community_id,
        local_user_index_canister_id,
        OPENCHAT_BOT_USER_ID,
        name,
        Vec::new(),
    )
    .await
    {
        Ok(UnitResult::Success) => {
            info!(%community_id, "Uninstalled community deleted");
            UnitResult::Success
        }
        Ok(UnitResult::Error(error)) => UnitResult::Error(error),
        Err(error) => UnitResult::Error(error.into()),
    }
}

struct PrepareResult {
    local_user_index_canister_id: CanisterId,
    name: String,
}

fn prepare(community_id: &CommunityId, state: &RuntimeState) -> Result<PrepareResult, OCError> {
    let Some(local_user_index_canister_id) = state.data.local_index_map.get_index_canister_for_community(community_id) else {
        return Err(OCErrorCode::CommunityNotFound.into());
    };

    // Only the LocalUserIndex which controls the community's canister can tell that it has been
    // uninstalled
    if state.env.caller() != local_user_index_canister_id {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    Ok(PrepareResult {
        local_user_index_canister_id,
        // Only a public community's name is known here
        name: state
            .data
            .public_communities
            .get(community_id)
            .map(|c| c.name().to_string())
            .unwrap_or_default(),
    })
}
