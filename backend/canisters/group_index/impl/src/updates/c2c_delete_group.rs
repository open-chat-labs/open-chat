use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_group::{Response::*, *};
use ic_cdk::api::call::CallResult;
use types::{CanisterId, ChatId, DeletedGroupInfo, UserId};

#[update_msgpack]
#[trace]
async fn c2c_delete_group(args: Args) -> Response {
    let PrepareResult {
        local_group_index_canister_id,
        chat_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match delete_group(
        chat_id,
        local_group_index_canister_id,
        args.deleted_by,
        args.group_name,
        args.members,
    )
    .await
    {
        Ok(local_group_index_canister::c2c_delete_group::Response::Success) => Success,
        Ok(local_group_index_canister::c2c_delete_group::Response::ChatNotFound) => ChatNotFound,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    pub local_group_index_canister_id: CanisterId,
    pub chat_id: ChatId,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    let chat_id = ChatId::from(caller);

    if let Some(local_group_index_canister_id) = state.data.local_index_map.get_index_canister(&chat_id) {
        Ok(PrepareResult {
            local_group_index_canister_id,
            chat_id,
        })
    } else {
        Err(ChatNotFound)
    }
}

pub(crate) async fn delete_group(
    chat_id: ChatId,
    local_group_index_canister_id: CanisterId,
    deleted_by: UserId,
    group_name: String,
    members: Vec<UserId>,
) -> CallResult<local_group_index_canister::c2c_delete_group::Response> {
    let response = local_group_index_canister_c2c_client::c2c_delete_group(
        local_group_index_canister_id,
        &local_group_index_canister::c2c_delete_group::Args { chat_id },
    )
    .await?;

    if matches!(response, local_group_index_canister::c2c_delete_group::Response::Success) {
        mutate_state(|state| commit(chat_id, deleted_by, group_name, members, state));
    }

    Ok(response)
}

fn commit(chat_id: ChatId, deleted_by: UserId, group_name: String, members: Vec<UserId>, state: &mut RuntimeState) {
    let now = state.env.now();

    let public = state.data.public_groups.delete(&chat_id).is_some();
    if !public {
        state.data.private_groups.delete(&chat_id);
    }

    state.data.deleted_groups.insert(
        DeletedGroupInfo {
            id: chat_id,
            timestamp: now,
            deleted_by,
            group_name,
            public,
        },
        members,
    );
    crate::jobs::push_group_deleted_notifications::start_job_if_required(state);
}
