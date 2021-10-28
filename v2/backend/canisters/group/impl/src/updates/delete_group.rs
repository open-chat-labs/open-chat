use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use group_canister::delete_group::{Response::*, *};
use group_index_canister::c2c_delete_group;
use ic_cdk_macros::update;
use tracing::{error, instrument};
use types::{CanisterId, ChatId};

#[update]
#[instrument(level = "trace")]
async fn delete_group(_args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let group_index_canister_id = prepare_result.group_index_canister_id;
    let c2c_delete_group_args = c2c_delete_group::Args {};

    match group_index_canister_c2c_client::c2c_delete_group(group_index_canister_id, &c2c_delete_group_args).await {
        Ok(response) => match response {
            c2c_delete_group::Response::ChatNotFound => {
                error!(chat_id = %prepare_result.chat_id, "Group not found in index");
                InternalError
            }
            c2c_delete_group::Response::Success => Success,
        },
        Err(_) => InternalError,
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    chat_id: ChatId,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if !participant.role.can_delete_group() {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                chat_id: runtime_state.env.canister_id().into(),
            })
        }
    } else {
        Err(NotAuthorized)
    }
}
