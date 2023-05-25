use crate::updates::c2c_delete_group::delete_group;
use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::delete_frozen_group::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn delete_frozen_group(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_index_canister_id,
        local_group_index_canister_id,
    } = match read_state(|state| prepare(&args.chat_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_moderator => user.user_id,
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    let c2c_args = group_canister::c2c_name_and_members::Args {};
    let group_canister::c2c_name_and_members::SuccessResult { name, members } =
        match group_canister_c2c_client::c2c_name_and_members(args.chat_id.into(), &c2c_args).await {
            Ok(group_canister::c2c_name_and_members::Response::Success(m)) => m,
            Err(error) => return InternalError(format!("{error:?}")),
        };

    match delete_group(args.chat_id, local_group_index_canister_id, user_id, name, members).await {
        Ok(local_group_index_canister::c2c_delete_group::Response::Success) => Success,
        Ok(local_group_index_canister::c2c_delete_group::Response::ChatNotFound) => ChatNotFound,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    local_group_index_canister_id: CanisterId,
}

fn prepare(chat_id: &ChatId, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(local_group_index_canister_id) = runtime_state.data.local_index_map.get_index_canister_for_group(chat_id) {
        match runtime_state.data.group_frozen_info(chat_id) {
            Some(Some(_)) => Ok(PrepareResult {
                caller: runtime_state.env.caller(),
                user_index_canister_id: runtime_state.data.user_index_canister_id,
                local_group_index_canister_id,
            }),
            Some(None) => Err(ChatNotFrozen),
            None => Err(ChatNotFound),
        }
    } else {
        Err(ChatNotFound)
    }
}
