use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::{add_hot_group_exclusion, remove_hot_group_exclusion};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn add_hot_group_exclusion(args: add_hot_group_exclusion::Args) -> add_hot_group_exclusion::Response {
    use group_index_canister::add_hot_group_exclusion::Response::*;

    let PrepareResult {
        caller,
        user_index_canister_id,
        ..
    } = match read_state(|state| prepare(&args.chat_id, state)) {
        Ok(result) if !result.is_excluded => result,
        Ok(_) => return ChatAlreadyExcluded,
        Err(_) => return ChatNotFound,
    };

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_moderator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    match mutate_state(|state| commit(&args.chat_id, true, state)) {
        false => ChatNotFound,
        true => Success,
    }
}

#[update]
#[trace]
async fn remove_hot_group_exclusion(args: remove_hot_group_exclusion::Args) -> remove_hot_group_exclusion::Response {
    use group_index_canister::remove_hot_group_exclusion::Response::*;

    let PrepareResult {
        caller,
        user_index_canister_id,
        ..
    } = match read_state(|state| prepare(&args.chat_id, state)) {
        Ok(result) if result.is_excluded => result,
        Ok(_) => return ChatNotExcluded,
        Err(_) => return ChatNotFound,
    };

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_moderator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    match mutate_state(|state| commit(&args.chat_id, false, state)) {
        false => ChatNotFound,
        true => Success,
    }
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    is_excluded: bool,
}

fn prepare(chat_id: &ChatId, state: &RuntimeState) -> Result<PrepareResult, ()> {
    if let Some(group) = state.data.public_groups.get(chat_id) {
        Ok(PrepareResult {
            caller: state.env.caller(),
            is_excluded: group.is_excluded_from_hotlist(),
            user_index_canister_id: state.data.user_index_canister_id,
        })
    } else {
        // ChatNotFound
        Err(())
    }
}

fn commit(chat_id: &ChatId, exclude: bool, state: &mut RuntimeState) -> bool {
    if let Some(group) = state.data.public_groups.get_mut(chat_id) {
        group.set_excluded_from_hotlist(exclude);
        true
    } else {
        // ChatNotFound
        false
    }
}
