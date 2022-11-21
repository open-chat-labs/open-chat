use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::{freeze_group, unfreeze_group};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, FrozenGroupInfo, UserId};

#[update]
#[trace]
async fn freeze_group(args: freeze_group::Args) -> freeze_group::Response {
    use group_index_canister::freeze_group::Response::*;

    let PrepareResult {
        caller,
        user_index_canister_id,
        ..
    } = match read_state(|state| prepare(&args.chat_id, state)) {
        Ok(ok) if !ok.is_frozen => ok,
        Ok(_) => return ChatAlreadyFrozen,
        Err(_) => return ChatNotFound,
    };

    let user_id = match get_and_validate_user(caller, user_index_canister_id).await {
        Ok(id) => id,
        Err(ValidateResult::NotAuthorized) => return NotAuthorized,
        Err(ValidateResult::InternalError(error)) => return InternalError(error),
    };

    let c2c_args = group_canister::c2c_freeze_group::Args {
        caller: user_id,
        reason: args.reason.clone(),
    };
    match group_canister_c2c_client::c2c_freeze_group(args.chat_id.into(), &c2c_args).await {
        Ok(group_canister::c2c_freeze_group::Response::Success) => {
            mutate_state(|state| {
                let info = FrozenGroupInfo {
                    timestamp: state.env.now(),
                    frozen_by: user_id,
                    reason: args.reason,
                };
                commit(&args.chat_id, Some(info), state);
            });
            Success
        }
        Ok(group_canister::c2c_freeze_group::Response::ChatAlreadyFrozen) => ChatAlreadyFrozen,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

#[update]
#[trace]
async fn unfreeze_group(args: unfreeze_group::Args) -> unfreeze_group::Response {
    use group_index_canister::unfreeze_group::Response::*;

    let PrepareResult {
        caller,
        user_index_canister_id,
        ..
    } = match read_state(|state| prepare(&args.chat_id, state)) {
        Ok(ok) if ok.is_frozen => ok,
        Ok(_) => return ChatNotFrozen,
        Err(_) => return ChatNotFound,
    };

    let user_id = match get_and_validate_user(caller, user_index_canister_id).await {
        Ok(id) => id,
        Err(ValidateResult::NotAuthorized) => return NotAuthorized,
        Err(ValidateResult::InternalError(error)) => return InternalError(error),
    };

    let c2c_args = group_canister::c2c_unfreeze_group::Args { caller: user_id };
    match group_canister_c2c_client::c2c_unfreeze_group(args.chat_id.into(), &c2c_args).await {
        Ok(group_canister::c2c_unfreeze_group::Response::Success) => {
            mutate_state(|state| commit(&args.chat_id, None, state));
            Success
        }
        Ok(group_canister::c2c_unfreeze_group::Response::ChatNotFrozen) => ChatNotFrozen,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    is_frozen: bool,
}

fn prepare(chat_id: &ChatId, runtime_state: &RuntimeState) -> Result<PrepareResult, ()> {
    if let Some(is_frozen) = runtime_state
        .data
        .public_groups
        .get(chat_id)
        .map(|g| g.frozen())
        .or_else(|| runtime_state.data.private_groups.get(chat_id).map(|g| g.frozen()))
    {
        Ok(PrepareResult {
            caller: runtime_state.env.caller(),
            is_frozen,
            user_index_canister_id: runtime_state.data.user_index_canister_id,
        })
    } else {
        // ChatNotFound
        Err(())
    }
}

fn commit(chat_id: &ChatId, info: Option<FrozenGroupInfo>, runtime_state: &mut RuntimeState) {
    if let Some(chat) = runtime_state.data.public_groups.get_mut(chat_id) {
        chat.set_frozen(info);
    } else if let Some(chat) = runtime_state.data.private_groups.get_mut(chat_id) {
        chat.set_frozen(info);
    } else {
        unreachable!();
    }
}

enum ValidateResult {
    NotAuthorized,
    InternalError(String),
}

async fn get_and_validate_user(caller: Principal, user_index_canister_id: CanisterId) -> Result<UserId, ValidateResult> {
    let args = user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: caller,
    };

    match user_index_canister_c2c_client::c2c_lookup_user(user_index_canister_id, &args).await {
        Ok(user_index_canister::c2c_lookup_user::Response::Success(r)) => {
            if r.is_super_admin {
                Ok(r.user_id)
            } else {
                Err(ValidateResult::NotAuthorized)
            }
        }
        Ok(_) => Err(ValidateResult::NotAuthorized),
        Err(error) => Err(ValidateResult::InternalError(format!("{error:?}"))),
    }
}
