use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use group_canister::c2c_leave_group;
use ic_cdk_macros::update;
use types::ChatId;
use user_canister::leave_group::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn leave_group(args: Args) -> Response {
    run_regular_jobs();

    let c2c_args = c2c_leave_group::Args {};

    match group_canister_c2c_client::c2c_leave_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_group::Response::Success(_) | c2c_leave_group::Response::CallerNotInGroup => {
                mutate_state(|state| commit(args.chat_id, state));
                Success
            }
            c2c_leave_group::Response::OwnerCannotLeave => OwnerCannotLeave,
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(chat_id: ChatId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state.data.group_chats.remove(chat_id, now);
    runtime_state.data.recommended_group_exclusions.add(chat_id, None, now);
}
