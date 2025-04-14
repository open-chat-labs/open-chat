use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::undelete_messages::{Response::*, *};
use std::collections::HashSet;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn undelete_messages(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| undelete_messages_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

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
}
