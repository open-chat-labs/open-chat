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
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let latest_event_index = runtime_state.data.events.main().last().index;

        if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
            return ReplicaNotUpToDate(latest_event_index);
        }

        Success(SuccessResult {
            threads: args
                .threads
                .into_iter()
                .filter_map(|root_message_index| {
                    build_thread_preview(
                        runtime_state,
                        participant.user_id,
                        participant.min_visible_event_index(),
                        root_message_index,
                    )
                })
                .collect(),
            latest_event_index,
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
    let root_message = main.message_by_message_index(root_message_index, Some(caller_user_id))?;
    if root_message.index >= min_visible_event_index {
        let thread_events = all_chat_events.get(Some(root_message_index))?;
        return Some(ThreadPreview {
            root_message,
            latest_replies: thread_events.latest_messages(MAX_PREVIEWED_REPLY_COUNT, Some(caller_user_id)),
            total_replies: thread_events.next_message_index().into(),
        });
    }

    None
}
