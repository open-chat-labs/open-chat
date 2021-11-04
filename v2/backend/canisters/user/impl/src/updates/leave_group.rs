use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use group_canister::c2c_leave_group;
use ic_cdk_macros::update;
use types::ChatId;
use user_canister::leave_group::{Response::*, *};

#[update]
#[trace]
async fn leave_group(args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap())) {
        return response;
    };

    let c2c_args = c2c_leave_group::Args {};

    match group_canister_c2c_client::c2c_leave_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_group::Response::Success(_) => {
                RUNTIME_STATE.with(|state| commit(args.chat_id, state.borrow_mut().as_mut().unwrap()));
                Success
            }
            c2c_leave_group::Response::CallerNotInGroup => CallerNotInGroup,
            c2c_leave_group::Response::OwnerCannotLeave => OwnerCannotLeave,
        },
        Err(error) => InternalError(format!("{:?}", error)),
    }
}

fn prepare(runtime_state: &RuntimeState) -> Result<(), Response> {
    runtime_state.trap_if_caller_not_owner();
    Ok(())
}

fn commit(chat_id: ChatId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state.data.group_chats.remove(chat_id, now);
}
