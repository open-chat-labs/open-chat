use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use group_canister::undelete_messages::{Response::*, *};
use group_chat_core::UndeleteMessagesResult;
use ic_cdk_macros::update;
use std::collections::HashSet;

#[update]
#[trace]
fn undelete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| undelete_messages_impl(args, state))
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();
        match state
            .data
            .chat
            .undelete_messages(member.user_id, args.thread_root_message_index, args.message_ids, now)
        {
            UndeleteMessagesResult::Success(messages) => {
                if !messages.is_empty() {
                    let message_ids: HashSet<_> = messages.iter().map(|m| m.message_id).collect();
                    state.data.timer_jobs.cancel_jobs(|job| {
                        if let TimerJob::HardDeleteMessageContent(j) = job {
                            j.thread_root_message_index == args.thread_root_message_index && message_ids.contains(&j.message_id)
                        } else {
                            false
                        }
                    });

                    handle_activity_notification(state);
                }

                Success(SuccessResult { messages })
            }
            UndeleteMessagesResult::MessageNotFound => MessageNotFound,
            UndeleteMessagesResult::UserNotInGroup => CallerNotInGroup,
            UndeleteMessagesResult::UserSuspended => UserSuspended,
        }
    } else {
        CallerNotInGroup
    }
}
