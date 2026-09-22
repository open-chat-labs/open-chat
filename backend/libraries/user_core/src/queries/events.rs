use crate::User;
use crate::queries::read_events;
use chat_events::Reader;
use types::{EventsResponse, OCResult, UserId};
use user_canister::events::Args;

pub fn events(user: &User, args: Args, my_user_id: UserId) -> OCResult<EventsResponse> {
    read_events(user, args.them, args.thread_root_message_index, |events_reader| {
        events_reader.scan(
            Some(args.start_index.into()),
            args.ascending,
            args.max_messages as usize,
            args.max_events as usize,
            Some(my_user_id),
        )
    })
}
