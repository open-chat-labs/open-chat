use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::c2c_leave_group;
use ic_cdk_macros::update;
use types::GroupChatId;
use user_canister::leave_group::{Response::*, *};

#[update]
async fn leave_group(args: Args) -> Response {
    if let Err(response) = RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap())) {
        return response;
    };

    let c2c_args = c2c_leave_group::Args {};

    match group_canister_client::c2c_leave_group(args.group_chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_group::Response::Success(_) => {
                RUNTIME_STATE.with(|state| commit(&args.group_chat_id, state.borrow_mut().as_mut().unwrap()));
                Success
            }
            c2c_leave_group::Response::NotInGroup => NotInGroup,
        },
        Err(error) => InternalError(format!("{:?}", error)),
    }
}

fn prepare(runtime_state: &RuntimeState) -> Result<(), Response> {
    if runtime_state.is_caller_owner() {
        Ok(())
    } else {
        Err(NotAuthorized)
    }
}

fn commit(group_chat_id: &GroupChatId, runtime_state: &mut RuntimeState) {
    runtime_state.data.group_chats.remove(group_chat_id);
}
