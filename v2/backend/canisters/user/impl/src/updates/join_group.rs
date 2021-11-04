use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use candid::Principal;
use canister_api_macros::trace;
use group_canister::c2c_join_group;
use ic_cdk_macros::update;
use types::ChatId;
use user_canister::join_group::{Response::*, *};

#[update]
#[trace]
async fn join_group(args: Args) -> Response {
    run_regular_jobs();

    let prepare_ok = match RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_args = c2c_join_group::Args {
        principal: prepare_ok.principal,
    };

    match group_canister_c2c_client::c2c_join_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_join_group::Response::Success(_) => {
                RUNTIME_STATE.with(|state| commit(args.chat_id, state.borrow_mut().as_mut().unwrap()));
                Success
            }
            c2c_join_group::Response::AlreadyInGroup => AlreadyInGroup,
            c2c_join_group::Response::GroupNotPublic => GroupNotPublic,
            c2c_join_group::Response::Blocked => Blocked,
            c2c_join_group::Response::ParticipantLimitReached(limit) => ParticipantLimitReached(limit),
        },
        Err(error) => InternalError(format!("{:?}", error)),
    }
}

struct PrepareResult {
    principal: Principal,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    runtime_state.trap_if_caller_not_owner();

    Ok(PrepareResult {
        principal: runtime_state.env.caller(),
    })
}

fn commit(chat_id: ChatId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state.data.group_chats.join(chat_id, now);
}
