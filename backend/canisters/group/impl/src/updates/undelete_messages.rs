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

fn undelete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = runtime_state.env.now();
        match runtime_state
            .data
            .chat
            .undelete_messages(member.user_id, args.thread_root_message_index, args.message_ids, now)
        {
            UndeleteMessagesResult::Success(messages) => {
                if !messages.is_empty() {
                    let message_ids: HashSet<_> = messages.iter().map(|m| m.message_id).collect();
                    runtime_state.data.timer_jobs.cancel_jobs(|job| {
                        if let TimerJob::HardDeleteMessageContent(j) = job {
                            j.thread_root_message_index == args.thread_root_message_index && message_ids.contains(&j.message_id)
                        } else {
                            false
                        }
                    });

                    handle_activity_notification(runtime_state);
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
