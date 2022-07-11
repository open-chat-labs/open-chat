use crate::{read_state, RuntimeState};
use group_canister::thread_previews::{Response::*, *};
use ic_cdk_macros::query;
use types::{EventIndex, MessageIndex, UserId};

const MAX_PREVIEWED_REPLY_COUNT: u32 = 2;

#[query]
fn thread_previews(args: Args) -> Response {
    read_state(|state| thread_previews_impl(args, state))
}

fn thread_previews_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(partipant) = runtime_state.data.participants.get_by_principal(&caller) {
        Success(SuccessResult {
            threads: args
                .threads
                .into_iter()
                .filter_map(|root_message_index| {
                    build_thread_preview(
                        runtime_state,
                        partipant.user_id,
                        partipant.min_visible_event_index(),
                        root_message_index,
                    )
                })
                .collect(),
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
) -> Option<ThreadPreview> {
    let all_chat_events = &runtime_state.data.events;
    let main = all_chat_events.main();
    let root_message_internal = main.message_by_message_index(root_message_index)?;
    if root_message_internal.index >= min_visible_event_index {
        let thread_events = all_chat_events.get(Some(root_message_index))?;
        return Some(ThreadPreview {
            root_message: main.hydrate_message(root_message_internal.event, Some(caller_user_id)),
            latest_replies: thread_events
                .latest_messages(MAX_PREVIEWED_REPLY_COUNT, true)
                .iter()
                .map(|message_internal| thread_events.hydrate_message(message_internal, Some(caller_user_id)))
                .collect(),
            total_replies: thread_events.next_message_index().into(),
        });
    }

    None
}
