use crate::model::group_chat::GroupChat;
use crate::{RuntimeState, RUNTIME_STATE};
use candid::Principal;
use group_canister::updates::join_group;
use ic_cdk_macros::update;
use shared::types::chat_id::GroupChatId;
use user_canister::updates::join_group::{Response::*, *};

#[update]
async fn join_group(args: Args) -> Response {
    let prepare_ok = match RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_args = join_group::Args {
        principal: prepare_ok.principal,
    };

    match group_canister_client::updates::join_group(args.group_chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            join_group::Response::Success(_) => {
                RUNTIME_STATE.with(|state| confirm(args.group_chat_id, state.borrow_mut().as_mut().unwrap()));
                Success
            }
            join_group::Response::AlreadyInGroup => AlreadyInGroup,
            join_group::Response::GroupNotPublic => GroupNotPublic,
            join_group::Response::Blocked => Blocked,
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

fn confirm(group_chat_id: GroupChatId, runtime_state: &mut RuntimeState) {
    runtime_state
        .data
        .group_chats
        .insert(group_chat_id, GroupChat::new(group_chat_id));
}
