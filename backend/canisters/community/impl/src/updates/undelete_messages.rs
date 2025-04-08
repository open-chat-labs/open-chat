use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::undelete_messages::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use std::collections::HashSet;

#[update(msgpack = true)]
#[trace]
fn undelete_messages(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| undelete_messages_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> Result<SuccessResult, OCError> {
    if state.data.is_frozen() {
        return Err(OCErrorCode::CommunityFrozen.into());
    }

    let caller = state.env.caller();
    let member = state.data.members.get_verified_member(caller)?;

    let now = state.env.now();
    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let messages = channel
            .chat
            .undelete_messages(member.user_id, args.thread_root_message_index, args.message_ids, now)?;

        if !messages.is_empty() {
            let message_ids: HashSet<_> = messages.iter().map(|m| m.message_id).collect();
            state.data.timer_jobs.cancel_jobs(|job| {
                if let TimerJob::HardDeleteMessageContent(j) = job {
                    j.channel_id == args.channel_id
                        && j.thread_root_message_index == args.thread_root_message_index
                        && message_ids.contains(&j.message_id)
                } else {
                    false
                }
            });

            handle_activity_notification(state);
        }

        Ok(SuccessResult { messages })
    } else {
        Err(OCErrorCode::InitiatorNotInChat.into())
    }
}
