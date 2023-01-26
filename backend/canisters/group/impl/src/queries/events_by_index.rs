use crate::{read_state, RuntimeState};
use chat_events::Reader;
use group_canister::events_by_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller, args.invite_code) {
        if let Some(events_reader) = runtime_state
            .data
            .events
            .events_reader(min_visible_event_index, args.thread_root_message_index)
        {
            let latest_event_index = events_reader.latest_event_index().unwrap();

            if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                return ReplicaNotUpToDate(latest_event_index);
            }

            let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);
            let events = events_reader.get_by_indexes(&args.events, user_id);
            let affected_events = events_reader.affected_events(&events, user_id);

            Success(SuccessResult {
                events,
                affected_events,
                latest_event_index,
            })
        } else {
            ThreadMessageNotFound
        }
    } else {
        CallerNotInGroup
    }
}
