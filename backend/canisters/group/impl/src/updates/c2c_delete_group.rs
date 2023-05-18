use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_delete_group::{Response::*, *};
use group_index_canister::c2c_delete_group;
use tracing::error;
use types::{CanisterId, ChatId, UserId};

#[update_msgpack]
#[trace]
async fn c2c_delete_group(_args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let group_index_canister_id = prepare_result.group_index_canister_id;
    let c2c_delete_group_args = c2c_delete_group::Args {
        deleted_by: prepare_result.deleted_by,
        group_name: prepare_result.group_name,
        members: prepare_result.members,
    };

    match group_index_canister_c2c_client::c2c_delete_group(group_index_canister_id, &c2c_delete_group_args).await {
        Ok(response) => match response {
            c2c_delete_group::Response::ChatNotFound => {
                error!(chat_id = %prepare_result.chat_id, "Group not found in group index");
                InternalError("Group not found in group index".to_string())
            }
            c2c_delete_group::Response::Success => Success,
            c2c_delete_group::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    chat_id: ChatId,
    deleted_by: UserId,
    group_name: String,
    members: Vec<UserId>,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if runtime_state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = runtime_state.env.caller().into();
    if let Some(participant) = runtime_state.data.group_chat_core.members.get(&caller) {
        if !participant.role.can_delete_group() {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                chat_id: runtime_state.env.canister_id().into(),
                deleted_by: participant.user_id,
                group_name: runtime_state.data.group_chat_core.name.clone(),
                members: runtime_state.data.group_chat_core.members.iter().map(|m| m.user_id).collect(),
            })
        }
    } else {
        Err(NotAuthorized)
    }
}
