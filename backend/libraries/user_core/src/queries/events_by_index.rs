use crate::User;
use crate::queries::read_events;
use chat_events::Reader;
use types::{EventsResponse, OCResult, UserId};
use user_canister::events_by_index::Args;

pub fn events_by_index(user: &User, args: Args, my_user_id: UserId) -> OCResult<EventsResponse> {
    read_events(user, args.them, args.thread_root_message_index, |events_reader| {
        events_reader.get_by_indexes(&args.events, Some(my_user_id))
    })
}
