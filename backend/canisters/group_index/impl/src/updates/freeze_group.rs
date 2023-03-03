use crate::{mutate_state, read_state, validate_user_is_platform_moderator, RuntimeState, ValidationError};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::{freeze_group, unfreeze_group};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, FrozenGroupInfo};

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

    let user_id = match validate_user_is_platform_moderator(caller, user_index_canister_id).await {
        Ok(id) => id,
        Err(ValidationError::NotSuperAdmin) => return NotAuthorized,
        Err(ValidationError::InternalError(error)) => return InternalError(error),
    };

    let c2c_args = group_canister::c2c_freeze_group::Args {
        caller: user_id,
        reason: args.reason.clone(),
        return_members: args.suspend_members.is_some(),
    };
    match group_canister_c2c_client::c2c_freeze_group(args.chat_id.into(), &c2c_args).await {
        Ok(group_canister::c2c_freeze_group::Response::Success(event)) => {
            mutate_state(|state| {
                let info = FrozenGroupInfo {
                    timestamp: state.env.now(),
                    frozen_by: user_id,
                    reason: args.reason,
                };
                commit(&args.chat_id, Some(info), state);
            });
            Success(event)
        }
        Ok(group_canister::c2c_freeze_group::Response::SuccessWithMembers(event, members)) => {
            let user_index_canister_id = mutate_state(|state| {
                let info = FrozenGroupInfo {
                    timestamp: state.env.now(),
                    frozen_by: user_id,
                    reason: args.reason,
                };
                commit(&args.chat_id, Some(info), state);
                state.data.user_index_canister_id
            });
            if let Some(suspension_details) = args.suspend_members {
                let suspend_users_args = user_index_canister::c2c_suspend_users::Args {
                    user_ids: members,
                    duration: suspension_details.duration,
                    reason: suspension_details.reason,
                    suspended_by: user_id,
                };
                user_index_canister_c2c_client::c2c_suspend_users(user_index_canister_id, &suspend_users_args)
                    .await
                    .unwrap();
            }
            Success(event)
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

    let user_id = match validate_user_is_platform_moderator(caller, user_index_canister_id).await {
        Ok(id) => id,
        Err(ValidationError::NotSuperAdmin) => return NotAuthorized,
        Err(ValidationError::InternalError(error)) => return InternalError(error),
    };

    let c2c_args = group_canister::c2c_unfreeze_group::Args { caller: user_id };
    match group_canister_c2c_client::c2c_unfreeze_group(args.chat_id.into(), &c2c_args).await {
        Ok(group_canister::c2c_unfreeze_group::Response::Success(event)) => {
            mutate_state(|state| commit(&args.chat_id, None, state));
            Success(event)
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
    if let Some(frozen_info) = runtime_state.data.chat_frozen_info(chat_id) {
        Ok(PrepareResult {
            caller: runtime_state.env.caller(),
            is_frozen: frozen_info.is_some(),
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
