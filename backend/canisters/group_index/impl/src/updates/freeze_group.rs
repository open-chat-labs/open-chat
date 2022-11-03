use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::freeze_group::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, FrozenGroupInfo, UserId};

#[update]
#[trace]
async fn freeze_group(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_index_canister_id,
    } = match read_state(|state| prepare(&args.chat_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let user_id = match get_and_validate_user(caller, user_index_canister_id).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    let c2c_args = group_canister::c2c_freeze_group::Args {
        caller: user_id,
        reason: args.reason.clone(),
    };
    match group_canister_c2c_client::c2c_freeze_group(args.chat_id.into(), &c2c_args).await {
        Ok(group_canister::c2c_freeze_group::Response::Success) => {
            mutate_state(|state| commit(args.chat_id, user_id, args.reason, state));
            Success
        }
        Ok(group_canister::c2c_freeze_group::Response::AlreadyFrozen) => AlreadyFrozen,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
}

fn prepare(chat_id: &ChatId, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let group_exists =
        runtime_state.data.public_groups.get(chat_id).is_some() || runtime_state.data.private_groups.get(chat_id).is_some();

    if group_exists {
        Ok(PrepareResult {
            caller: runtime_state.env.caller(),
            user_index_canister_id: runtime_state.data.user_index_canister_id,
        })
    } else {
        Err(ChatNotFound)
    }
}

fn commit(chat_id: ChatId, frozen_by: UserId, reason: Option<String>, runtime_state: &mut RuntimeState) {
    let info = FrozenGroupInfo {
        timestamp: runtime_state.env.now(),
        frozen_by,
        reason,
    };
    if let Some(chat) = runtime_state.data.public_groups.get_mut(&chat_id) {
        chat.mark_frozen(info);
    } else if let Some(chat) = runtime_state.data.private_groups.get_mut(&chat_id) {
        chat.mark_frozen(info);
    } else {
        unreachable!();
    }
}

async fn get_and_validate_user(caller: Principal, user_index_canister_id: CanisterId) -> Result<UserId, Response> {
    let args = user_index_canister::c2c_lookup_user_id_v2::Args { user_principal: caller };

    match user_index_canister_c2c_client::c2c_lookup_user_id_v2(user_index_canister_id, &args).await {
        Ok(user_index_canister::c2c_lookup_user_id_v2::Response::Success(r)) => {
            if r.is_super_admin {
                Ok(r.user_id)
            } else {
                Err(NotAuthorized)
            }
        }
        Ok(_) => Err(NotAuthorized),
        Err(error) => Err(InternalError(format!("{error:?}"))),
    }
}
