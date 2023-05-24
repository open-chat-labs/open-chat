use crate::{read_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_delete_community::{Response::*, *};
use group_index_canister::c2c_delete_community;
use tracing::error;
use types::{CanisterId, CommunityId, UserId};

#[update_msgpack]
#[trace]
async fn c2c_delete_community(_args: Args) -> Response {
    let prepare_result = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let group_index_canister_id = prepare_result.group_index_canister_id;
    let c2c_delete_community_args = c2c_delete_community::Args {
        deleted_by: prepare_result.deleted_by,
        community_name: prepare_result.communtiy_name,
        members: prepare_result.members,
    };

    match group_index_canister_c2c_client::c2c_delete_community(group_index_canister_id, &c2c_delete_community_args).await {
        Ok(response) => match response {
            c2c_delete_community::Response::CommunityNotFound => {
                error!(community_id = %prepare_result.community_id, "Community not found in group index");
                InternalError("Community not found in group index".to_string())
            }
            c2c_delete_community::Response::Success => Success,
            c2c_delete_community::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    community_id: CommunityId,
    deleted_by: UserId,
    communtiy_name: String,
    members: Vec<UserId>,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if !member.role.can_delete_community() {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: state.data.group_index_canister_id,
                community_id: state.env.canister_id().into(),
                deleted_by: member.user_id,
                communtiy_name: state.data.name.clone(),
                members: state.data.members.iter().map(|m| m.user_id).collect(),
            })
        }
    } else {
        Err(NotAuthorized)
    }
}
