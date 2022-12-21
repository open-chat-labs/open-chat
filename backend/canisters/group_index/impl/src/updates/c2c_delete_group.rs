use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_group::{Response::*, *};
use types::{CanisterId, ChatId, DeletedGroupInfo};

#[update_msgpack]
#[trace]
async fn c2c_delete_group(args: Args) -> Response {
    let PrepareResult {
        local_group_index_canister,
        chat_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match local_group_index_canister_c2c_client::c2c_delete_group(
        local_group_index_canister,
        &local_group_index_canister::c2c_delete_group::Args { chat_id },
    )
    .await
    {
        Ok(local_group_index_canister::c2c_delete_group::Response::Success) => {
            mutate_state(|state| commit(args, chat_id, state));
            Success
        }
        Ok(local_group_index_canister::c2c_delete_group::Response::ChatNotFound) => ChatNotFound,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    pub local_group_index_canister: CanisterId,
    pub chat_id: ChatId,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    let chat_id = ChatId::from(caller);

    if let Some(local_group_index_canister) = state.data.local_index_map.get_index_canister(&chat_id) {
        Ok(PrepareResult {
            local_group_index_canister,
            chat_id,
        })
    } else {
        Err(ChatNotFound)
    }
}

fn commit(args: Args, chat_id: ChatId, state: &mut RuntimeState) {
    let now = state.env.now();

    let public = state.data.public_groups.delete(&chat_id).is_some();
    if !public {
        state.data.private_groups.delete(&chat_id);
    }

    state.data.deleted_groups.insert(
        DeletedGroupInfo {
            id: chat_id,
            timestamp: now,
            deleted_by: args.deleted_by,
            group_name: args.group_name,
            public,
        },
        args.members,
    );
}
