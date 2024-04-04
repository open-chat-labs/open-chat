use crate::guards::caller_is_owner_or_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use canister_api_macros::query_candid_and_msgpack;
use chat_events::Reader;
use types::{EventIndex, EventOrExpiredRange, EventsResponse};
use user_canister::events_by_index::{Response::*, *};

#[query_candid_and_msgpack(guard = "caller_is_owner_or_local_user_index")]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    if let Some(chat) = state.data.direct_chats.get(&args.user_id.into()) {
        let Some(events_reader) = chat
            .events
            .events_reader(EventIndex::default(), args.thread_root_message_index)
        else {
            return ThreadMessageNotFound;
        };
        let my_user_id = state.env.canister_id().into();
        let (events, expired_event_ranges) =
            EventOrExpiredRange::split(events_reader.get_by_indexes(&args.events, Some(my_user_id)));
        let expired_message_ranges = chat.events.convert_to_message_ranges(&expired_event_ranges);
        let latest_event_index = events_reader.latest_event_index().unwrap();
        let chat_last_updated = chat.last_updated();

        Success(EventsResponse {
            events,
            expired_event_ranges,
            expired_message_ranges,
            latest_event_index,
            chat_last_updated,
        })
    } else {
        ChatNotFound
    }
}
