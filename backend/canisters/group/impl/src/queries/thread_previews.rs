use crate::{read_state, RuntimeState};
use chat_events::Reader;
use group_canister::thread_previews::{Response::*, *};
use ic_cdk_macros::query;
use types::{EventIndex, MessageIndex, TimestampMillis, UserId};

const MAX_PREVIEWED_REPLY_COUNT: usize = 2;

#[query]
fn thread_previews(args: Args) -> Response {
    read_state(|state| thread_previews_impl(args, state))
}

fn thread_previews_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(member) = runtime_state.data.get_member(caller) {
        let now = runtime_state.env.now();

        if args.latest_client_thread_update.map_or(false, |t| now < t) {
            return ReplicaNotUpToDate(now);
        }

        Success(SuccessResult {
            threads: args
                .threads
                .into_iter()
                .filter_map(|root_message_index| {
                    build_thread_preview(
                        runtime_state,
                        member.user_id,
                        member.min_visible_event_index(),
                        root_message_index,
                        now,
                    )
                })
                .collect(),
            timestamp: now,
        })
    } else {
        CallerNotInGroup
    }
}

fn build_thread_preview(
    runtime_state: &RuntimeState,
    caller_user_id: UserId,
    min_visible_event_index: EventIndex,
    root_message_index: MessageIndex,
    now: TimestampMillis,
) -> Option<ThreadPreview> {
    let events_reader = runtime_state
        .data
        .group_chat_core
        .events
        .visible_main_events_reader(min_visible_event_index, now);

    let root_message = events_reader.message_event(root_message_index.into(), Some(caller_user_id))?;

    let thread_events_reader =
        runtime_state
            .data
            .group_chat_core
            .events
            .events_reader(min_visible_event_index, Some(root_message_index), now)?;

    Some(ThreadPreview {
        root_message,
        latest_replies: thread_events_reader
            .iter_latest_messages(Some(caller_user_id))
            .take(MAX_PREVIEWED_REPLY_COUNT)
            .collect(),
        total_replies: thread_events_reader.next_message_index().into(),
    })
}
