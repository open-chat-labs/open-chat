use crate::guards::caller_is_owner_or_local_user_index;
use crate::queries::events::read_events;
use crate::read_state;
use canister_api_macros::query;
use chat_events::{ChatEventsListReader, Reader};
use types::{EventOrExpiredRange, UserId};
use user_canister::events_by_index::*;

#[query(guard = "caller_is_owner_or_local_user_index", msgpack = true)]
fn events_by_index(args: Args) -> Response {
    read_state(|state| {
        read_events(
            args.latest_known_update,
            args.user_id,
            args.thread_root_message_index,
            args.bot_api_key_secret.clone(),
            args,
            events_by_index_impl,
            state,
        )
    })
}

fn events_by_index_impl(args: Args, my_user_id: UserId, events_reader: ChatEventsListReader) -> Vec<EventOrExpiredRange> {
    events_reader.get_by_indexes(&args.events, Some(my_user_id))
}
