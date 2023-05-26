use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::c2c_delete_group;
use ic_cdk_macros::update;
use types::ChatId;
use user_canister::delete_group::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn delete_group(args: Args) -> Response {
    run_regular_jobs();

    if read_state(|state| state.data.suspended.value) {
        return UserSuspended;
    }

    let c2c_args = c2c_delete_group::Args {};

    match group_canister_c2c_client::c2c_delete_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_delete_group::Response::Success => {
                mutate_state(|state| commit(args.chat_id, state));
                Success
            }
            c2c_delete_group::Response::NotAuthorized => NotAuthorized,
            c2c_delete_group::Response::ChatFrozen => ChatFrozen,
            c2c_delete_group::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(chat_id: ChatId, state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.group_chats.remove(chat_id, now);

    if let Some(cached_groups) = &mut state.data.cached_group_summaries {
        cached_groups.remove_group(&chat_id);
    }
}
