use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_client::make_c2c_call_raw;
use canister_tracing_macros::trace;
use community_canister::c2c_delete_community::{Response::*, *};
use group_index_canister::c2c_delete_community;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn c2c_delete_community(_args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match read_state(prepare) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let group_index_canister_id = prepare_result.group_index_canister_id;
    let c2c_delete_community_args = c2c_delete_community::Args {
        deleted_by: prepare_result.deleted_by,
        community_name: prepare_result.community_name,
        members: prepare_result.members,
    };

    delete_community(group_index_canister_id, &c2c_delete_community_args).await
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    deleted_by: UserId,
    community_name: String,
    members: Vec<UserId>,
}

fn prepare(state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    if !member.role().can_delete_community() {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    } else {
        Ok(PrepareResult {
            group_index_canister_id: state.data.group_index_canister_id,
            deleted_by: member.user_id,
            community_name: state.data.name.value.clone(),
            members: state.data.members.iter_member_ids().collect(),
        })
    }
}

async fn delete_community(group_index_canister_id: CanisterId, args: &c2c_delete_community::Args) -> Response {
    let method_name = "c2c_delete_community_msgpack";
    let payload = msgpack::serialize_then_unwrap(args);
    let c2c_cost = ic_cdk::api::cost_call(method_name.len() as u64, payload.len() as u64);
    let buffer = 1_000_000_000; // 1B
    let cycles = ic_cdk::api::canister_liquid_cycle_balance().saturating_sub(c2c_cost + buffer);

    if let Err(error) = make_c2c_call_raw(group_index_canister_id, method_name, &payload, cycles, None).await {
        Error(error.into())
    } else {
        Success
    }
}
