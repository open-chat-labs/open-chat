use crate::guards::caller_is_local_group_index;
use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use chat_events::Reader;
use group_canister::c2c_events_internal::{Response::*, *};
use types::EventIndex;

#[query_msgpack(guard = "caller_is_local_group_index")]
fn c2c_events_internal(args: Args) -> Response {
    read_state(|state| c2c_events_internal_impl(args, state))
}

fn c2c_events_internal_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();

    if let Some(events_reader) =
        state
            .data
            .chat
            .events
            .events_reader(EventIndex::default(), args.thread_root_message_index, now)
    {
        let latest_event_index = events_reader.latest_event_index().unwrap();
        let events = events_reader
            .iter(Some(args.start_index.into()), true)
            .take(args.max_events as usize)
            .cloned()
            .map(|e| e.into())
            .collect();

        Success(SuccessResult {
            events,
            latest_event_index,
        })
    } else {
        ThreadMessageNotFound
    }
}
