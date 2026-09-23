use crate::User;
use crate::queries::read_events;
use chat_events::Reader;
use types::{EventsResponse, OCResult, UserId, UserIdAndPrincipal};
use user_canister::events_window::Args;

pub fn events_window(user: &User, args: Args, my_user_id: UserId) -> OCResult<EventsResponse> {
    read_events(user, args.them, args.thread_root_message_index, |events_reader| {
        events_reader.window(
            args.mid_point.into(),
            args.max_messages as usize,
            args.max_events as usize,
            Some(UserIdAndPrincipal::new(my_user_id, user.principal)),
        )
    })
}
