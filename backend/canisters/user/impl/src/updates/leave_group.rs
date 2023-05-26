use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::c2c_leave_group;
use ic_cdk_macros::update;
use types::ChatId;
use user_canister::leave_group::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn leave_group(args: Args) -> Response {
    run_regular_jobs();

    if read_state(|state| state.data.suspended.value) {
        return UserSuspended;
    }

    let c2c_args = c2c_leave_group::Args {
        correlation_id: args.correlation_id,
    };

    match group_canister_c2c_client::c2c_leave_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_group::Response::Success(_) | c2c_leave_group::Response::CallerNotInGroup => {
                mutate_state(|state| commit(args.chat_id, state));
                if matches!(result, c2c_leave_group::Response::CallerNotInGroup) {
                    CallerNotInGroup
                } else {
                    Success
                }
            }
            c2c_leave_group::Response::OwnerCannotLeave => OwnerCannotLeave,
            c2c_leave_group::Response::UserSuspended => UserSuspended,
            c2c_leave_group::Response::ChatFrozen => ChatFrozen,
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

pub(crate) fn commit(chat_id: ChatId, state: &mut RuntimeState) {
    let now = state.env.now();

    state.data.group_chats.remove(chat_id, now);
    state.data.unpin_chat(&chat_id, now);
    state.data.hot_group_exclusions.add(chat_id, None, now);

    if let Some(cached_groups) = &mut state.data.cached_group_summaries {
        cached_groups.remove_group(&chat_id);
    }
}
