use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use chat_events::Reader;
use ic_cdk_macros::query;
use user_canister::events_by_index::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let now = runtime_state.env.now();
        let events_reader = chat.events.main_events_reader(now);
        let latest_event_index = events_reader.latest_event_index().unwrap();

        if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
            return ReplicaNotUpToDate(latest_event_index);
        }

        let my_user_id = runtime_state.env.canister_id().into();
        let events = events_reader.get_by_indexes(&args.events, Some(my_user_id));
        let affected_events = events_reader.affected_events(&events, Some(my_user_id));

        Success(SuccessResult {
            events,
            affected_events,
            latest_event_index,
        })
    } else {
        ChatNotFound
    }
}
