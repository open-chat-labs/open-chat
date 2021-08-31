use crate::{RuntimeState, RUNTIME_STATE};
use candid::Principal;
use group_canister::c2c_join_group;
use ic_cdk_macros::update;
use types::ChatId;
use user_canister::join_group::{Response::*, *};

#[update]
async fn join_group(args: Args) -> Response {
    let prepare_ok = match RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_args = c2c_join_group::Args {
        principal: prepare_ok.principal,
    };

    match group_canister_client::c2c_join_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_join_group::Response::Success(_) => {
                RUNTIME_STATE.with(|state| commit(args.chat_id, state.borrow_mut().as_mut().unwrap()));
                Success
            }
            c2c_join_group::Response::AlreadyInGroup => AlreadyInGroup,
            c2c_join_group::Response::GroupNotPublic => GroupNotPublic,
            c2c_join_group::Response::Blocked => Blocked,
        },
        Err(error) => InternalError(format!("{:?}", error)),
    }
}

struct PrepareResult {
    principal: Principal,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if runtime_state.is_caller_owner() {
        Ok(PrepareResult {
            principal: runtime_state.env.caller(),
        })
    } else {
        Err(NotAuthorized)
    }
}

fn commit(chat_id: ChatId, runtime_state: &mut RuntimeState) {
    runtime_state.data.group_chats.add(chat_id);
}
