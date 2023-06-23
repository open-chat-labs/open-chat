use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_delete_group::{Response::*, *};
use group_index_canister::c2c_delete_group;
use types::{CanisterId, UserId};

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
        Ok(_) => Success,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    deleted_by: UserId,
    group_name: String,
    members: Vec<UserId>,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = state.env.caller().into();
    if let Some(member) = state.data.chat.members.get(&caller) {
        if !member.role.can_delete_group() {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: state.data.group_index_canister_id,
                deleted_by: member.user_id,
                group_name: state.data.chat.name.clone(),
                members: state.data.chat.members.iter().map(|m| m.user_id).collect(),
            })
        }
    } else {
        Err(NotAuthorized)
    }
}
