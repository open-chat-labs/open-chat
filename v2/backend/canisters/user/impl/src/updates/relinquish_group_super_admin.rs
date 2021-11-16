use crate::guards::caller_is_owner;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use group_canister::c2c_relinquish_super_admin;
use ic_cdk_macros::update;
use tracing::error;
use types::ChatId;
use user_canister::relinquish_group_super_admin::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn relinquish_group_super_admin(args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = RUNTIME_STATE.with(|state| prepare(&args.chat_id, state.borrow().as_ref().unwrap())) {
        return response;
    }

    let c2c_args = c2c_relinquish_super_admin::Args {};
    match group_canister_c2c_client::c2c_relinquish_super_admin(args.chat_id.into(), &c2c_args).await {
        Ok(response) => match response {
            c2c_relinquish_super_admin::Response::Success => {
                RUNTIME_STATE.with(|state| commit(&args.chat_id, state.borrow_mut().as_mut().unwrap()));
                Success
            }
            c2c_relinquish_super_admin::Response::CallerNotInGroup => {
                let message = "INCONSISTENT: Caller has reference to group in user canister but group does not contain caller";
                error!(message);
                InternalError(message.to_owned())
            }
        },
        Err(error) => InternalError(format!("{:?}", error)),
    }
}

fn prepare(group_id: &ChatId, runtime_state: &RuntimeState) -> Result<(), Response> {
    match runtime_state.data.group_chats.get(group_id) {
        Some(group) => {
            if !group.is_super_admin {
                Err(NotSuperAdmin)
            } else {
                Ok(())
            }
        }
        None => Err(CallerNotInGroup),
    }
}

fn commit(group_id: &ChatId, runtime_state: &mut RuntimeState) {
    if let Some(group) = runtime_state.data.group_chats.get_mut(group_id) {
        group.is_super_admin = false;
    }
}
