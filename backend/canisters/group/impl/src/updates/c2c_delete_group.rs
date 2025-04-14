use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_client::make_c2c_call_raw;
use canister_tracing_macros::trace;
use group_canister::c2c_delete_group::{Response::*, *};
use group_index_canister::c2c_delete_group;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn c2c_delete_group(_args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match read_state(prepare) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let group_index_canister_id = prepare_result.group_index_canister_id;
    let c2c_delete_group_args = c2c_delete_group::Args {
        deleted_by: prepare_result.deleted_by,
        group_name: prepare_result.group_name,
        members: prepare_result.members,
    };

    delete_group(group_index_canister_id, &c2c_delete_group_args).await
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    deleted_by: UserId,
    group_name: String,
    members: Vec<UserId>,
}

fn prepare(state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    if !member.role().can_delete_group() {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    } else {
        Ok(PrepareResult {
            group_index_canister_id: state.data.group_index_canister_id,
            deleted_by: member.user_id(),
            group_name: state.data.chat.name.value.clone(),
            members: state.data.chat.members.member_ids().iter().copied().collect(),
        })
    }
}

pub(crate) async fn delete_group(group_index_canister_id: CanisterId, args: &c2c_delete_group::Args) -> Response {
    let method_name = "c2c_delete_group_msgpack";
    let payload = msgpack::serialize_then_unwrap(args);
    let c2c_cost = ic_cdk::api::cost_call(method_name.len() as u64, payload.len() as u64);
    let buffer = 1_000_000_000; // 1B
    let cycles = ic_cdk::api::canister_liquid_cycle_balance().saturating_sub(c2c_cost + buffer);

    match make_c2c_call_raw(group_index_canister_id, method_name, &payload, cycles, None).await {
        Ok(_) => Success,
        Err(error) => InternalError(format!("{error:?}")),
    }
}
