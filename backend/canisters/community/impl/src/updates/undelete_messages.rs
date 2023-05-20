use crate::{mutate_state, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use community_canister::undelete_messages::{Response::*, *};
use group_chat_core::UndeleteMessagesResult;
use ic_cdk_macros::update;
use std::collections::HashSet;

#[update]
#[trace]
fn undelete_messages(args: Args) -> Response {
    mutate_state(|state| undelete_messages_impl(args, state))
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();
        if let Some(group) = state.data.groups.get_mut(&args.group_id) {
            match group.undelete_messages(member.user_id, args.thread_root_message_index, args.message_ids, now) {
                UndeleteMessagesResult::Success(messages) => {
                    if !messages.is_empty() {
                        let message_ids: HashSet<_> = messages.iter().map(|m| m.message_id).collect();
                        state.data.timer_jobs.cancel_jobs(|job| {
                            if let TimerJob::HardDeleteMessageContent(j) = job {
                                j.group_id == args.group_id
                                    && j.thread_root_message_index == args.thread_root_message_index
                                    && message_ids.contains(&j.message_id)
                            } else {
                                false
                            }
                        });

                        // handle_activity_notification(state);
                    }

                    Success(SuccessResult { messages })
                }
                UndeleteMessagesResult::MessageNotFound => MessageNotFound,
                UndeleteMessagesResult::UserNotInGroup => UserNotInGroup,
                UndeleteMessagesResult::UserSuspended => UserSuspended,
            }
        } else {
            UserNotInGroup
        }
    } else {
        CallerNotInCommunity
    }
}
