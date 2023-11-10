use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use chat_events::Reader;
use ic_cdk_macros::query;
use types::{EventOrExpiredRange, EventsResponse};
use user_canister::events::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn events(args: Args) -> Response {
    read_state(|state| events_impl(args, state))
}

fn events_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get(&args.user_id.into()) {
        let chat_last_updated = chat.last_updated();

        if args.latest_known_update.map_or(false, |ts| chat_last_updated < ts) {
            return ReplicaNotUpToDateV2(chat_last_updated);
        }

        let events_reader = chat.events.main_events_reader();
        let my_user_id = state.env.canister_id().into();

        let (events, expired_event_ranges) = EventOrExpiredRange::split(events_reader.scan(
            Some(args.start_index.into()),
            args.ascending,
            args.max_messages as usize,
            args.max_events as usize,
            Some(my_user_id),
        ));
        let expired_message_ranges = chat.events.convert_to_message_ranges(&expired_event_ranges);
        let latest_event_index = events_reader.latest_event_index().unwrap();

        Success(EventsResponse {
            events,
            expired_event_ranges,
            expired_message_ranges,
            latest_event_index,
            chat_last_updated,
            timestamp: chat_last_updated,
        })
    } else {
        ChatNotFound
    }
}
