use crate::{mutate_state, read_state, validate_user_is_super_admin, RuntimeState, ValidationError};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::exclude_group_from_hotlist::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId};

#[update]
#[trace]
async fn exclude_group_from_hotlist(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_index_canister_id,
        ..
    } = match read_state(|state| prepare(&args.chat_id, state)) {
        Ok(ok) if !ok.is_excluded => ok,
        Ok(_) => return ChatAlreadyExcluded,
        Err(_) => return ChatNotFound,
    };

    match validate_user_is_super_admin(caller, user_index_canister_id).await {
        Ok(_) => (),
        Err(ValidationError::NotSuperAdmin) => return NotAuthorized,
        Err(ValidationError::InternalError(error)) => return InternalError(error),
    };

    mutate_state(|state| commit(&args.chat_id, state));

    Success
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    is_excluded: bool,
}

fn prepare(chat_id: &ChatId, runtime_state: &RuntimeState) -> Result<PrepareResult, ()> {
    if let Some(group) = runtime_state.data.public_groups.get(chat_id) {
        Ok(PrepareResult {
            caller: runtime_state.env.caller(),
            is_excluded: group.is_excluded_from_hotlist(),
            user_index_canister_id: runtime_state.data.user_index_canister_id,
        })
    } else {
        // ChatNotFound
        Err(())
    }
}

fn commit(chat_id: &ChatId, runtime_state: &mut RuntimeState) {
    if let Some(group) = runtime_state.data.public_groups.get_mut(chat_id) {
        group.set_excluded_from_hotlist(true);
    } else {
        unreachable!();
    }
}
