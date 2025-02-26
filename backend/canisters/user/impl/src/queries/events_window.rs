use crate::guards::caller_is_owner_or_local_user_index;
use crate::queries::events::read_events;
use crate::read_state;
use canister_api_macros::query;
use chat_events::{ChatEventsListReader, Reader};
use types::{EventOrExpiredRange, UserId};
use user_canister::events_window::*;

#[query(guard = "caller_is_owner_or_local_user_index", msgpack = true)]
fn events_window(args: Args) -> Response {
    read_state(|state| {
        read_events(
            args.latest_known_update,
            args.user_id,
            args.thread_root_message_index,
            args.bot_api_key_secret.clone(),
            args,
            events_window_impl,
            state,
        )
    })
}

fn events_window_impl(args: Args, my_user_id: UserId, events_reader: ChatEventsListReader) -> Vec<EventOrExpiredRange> {
    events_reader.window(
        args.mid_point.into(),
        args.max_messages as usize,
        args.max_events as usize,
        Some(my_user_id),
    )
}
