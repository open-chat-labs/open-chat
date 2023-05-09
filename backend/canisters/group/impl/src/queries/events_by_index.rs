use crate::{read_state, RuntimeState};
use chat_events::Reader;
use group_canister::events_by_index::{Response::*, *};
use ic_cdk_macros::query;
use types::EventsResponse;

#[query]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller, args.invite_code) {
        let now = runtime_state.env.now();

        if let Some(events_reader) =
            runtime_state
                .data
                .events
                .events_reader(min_visible_event_index, args.thread_root_message_index, now)
        {
            let latest_event_index = events_reader.latest_event_index().unwrap();

            if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                return ReplicaNotUpToDate(latest_event_index);
            }

            let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);
            let events = events_reader.get_by_indexes(&args.events, user_id);

            Success(EventsResponse {
                events,
                latest_event_index,
                timestamp: now,
            })
        } else {
            ThreadMessageNotFound
        }
    } else {
        CallerNotInGroup
    }
}
