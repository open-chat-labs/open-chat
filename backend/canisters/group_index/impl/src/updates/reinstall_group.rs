use crate::guards::caller_is_governance_principal;
use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use group_index_canister::reinstall_group::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId};

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn reinstall_group(args: Args) -> Response {
    let PrepareResult {
        local_group_index_canister,
    } = match read_state(|state| prepare(args.group_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match local_group_index_canister_c2c_client::c2c_reinstall_group(
        local_group_index_canister,
        &local_group_index_canister::c2c_reinstall_group::Args { group_id: args.group_id },
    )
    .await
    {
        Ok(local_group_index_canister::c2c_reinstall_group::Response::Success) => Success,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    pub local_group_index_canister: CanisterId,
}

fn prepare(chat_id: ChatId, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(local_group_index_canister) = state.data.local_index_map.get_index_canister(&chat_id) {
        Ok(PrepareResult {
            local_group_index_canister,
        })
    } else {
        Err(ChatNotFound)
    }
}
