use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_delete_community::{Response::*, *};
use group_index_canister::c2c_delete_community;
use tracing::error;
use types::{CanisterId, UserId};

#[update(msgpack = true)]
#[trace]
async fn c2c_delete_community(_args: Args) -> Response {
    run_regular_jobs();

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

    delete_community(group_index_canister_id, &c2c_delete_community_args).await
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
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
        if member.suspended().value {
            Err(UserSuspended)
        } else if member.lapsed().value {
            Err(UserLapsed)
        } else if !member.role().can_delete_community() {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: state.data.group_index_canister_id,
                deleted_by: member.user_id,
                communtiy_name: state.data.name.value.clone(),
                members: state.data.members.iter_member_ids().collect(),
            })
        }
    } else {
        Err(NotAuthorized)
    }
}

async fn delete_community(group_index_canister_id: CanisterId, args: &c2c_delete_community::Args) -> Response {
    let payload_size = msgpack::serialize_then_unwrap(args).len();
    let c2c_cost = ic_cdk::api::cost_call("c2c_delete_community_msgpack".len() as u64, payload_size as u64);
    let buffer = 1_000_000_000; // 1B
    let cycles = ic_cdk::api::canister_liquid_cycle_balance().saturating_sub(c2c_cost + buffer);

    match group_index_canister_c2c_client::c2c_delete_community(group_index_canister_id, &args, cycles).await {
        Ok(response) => match response {
            c2c_delete_community::Response::CommunityNotFound => {
                error!("Community not found in group index");
                InternalError("Community not found in group index".to_string())
            }
            c2c_delete_community::Response::Success => Success,
            c2c_delete_community::Response::Error(error) => Error(error),
            c2c_delete_community::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}
