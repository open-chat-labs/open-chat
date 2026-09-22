//! The query endpoints shared by the User and MultiUser canisters, one function per endpoint

use crate::User;
use chat_events::ChatEventsListReader;
use oc_error_codes::OCErrorCode;
use std::cmp::Reverse;
use std::collections::HashMap;
use std::hash::Hash;
use types::{Chat, EventOrExpiredRange, EventsResponse, MessageIndex, OCResult, TimestampMillis, UserId};

mod chit_events;
mod contacts;
mod deleted_message;
mod events;
mod events_by_index;
mod events_window;
mod initial_state;
mod messages_by_message_index;
mod public_profile;
mod updates;

pub use chit_events::chit_events;
pub use contacts::contacts;
pub use deleted_message::deleted_message;
pub use events::events;
pub use events_by_index::events_by_index;
pub use events_window::events_window;
pub use initial_state::initial_state;
pub use messages_by_message_index::messages_by_message_index;
pub use public_profile::public_profile;
pub use updates::updates;

// Reads events from the user's chat with `them`, or a thread in it, with `read` choosing which,
// and packages them as the events queries all respond. The caller checks the replica is up to date
// first, as for every events query.
fn read_events(
    user: &User,
    them: UserId,
    thread_root_message_index: Option<MessageIndex>,
    read: impl FnOnce(ChatEventsListReader) -> Vec<EventOrExpiredRange>,
) -> OCResult<EventsResponse> {
    let chat = user.direct_chats.get_or_err(&them.into())?;
    let events_reader = chat
        .events_reader(thread_root_message_index)
        .ok_or(OCErrorCode::ThreadNotFound)?;

    let latest_event_index = events_reader.latest_event_index().unwrap_or_default();
    let (events, expired_event_ranges, _) = EventOrExpiredRange::split(read(events_reader));
    let expired_message_ranges = chat.events().convert_to_message_ranges(&expired_event_ranges);

    Ok(EventsResponse {
        events,
        unauthorized: Vec::new(),
        expired_event_ranges,
        expired_message_ranges,
        latest_event_index,
        chat_last_updated: chat.last_updated(),
    })
}

// The user's pinned direct and group chats, most recently pinned first, which are pinned in the
// one list
fn pinned_direct_and_group_chats(user: &User) -> Vec<Chat> {
    sorted_pinned(&merge_maps(
        &user.direct_chats.pinned_chats(),
        &user.group_chats.pinned_chats(),
    ))
}

// The keys of `map`, whose values are when each was pinned, most recently pinned first
pub(crate) fn sorted_pinned<T: Clone>(map: &HashMap<T, TimestampMillis>) -> Vec<T> {
    use itertools::Itertools;

    map.iter()
        .map(|(key, &ts)| (key.clone(), ts))
        .sorted_by_key(|(_, ts)| Reverse(*ts))
        .map(|(key, _)| key)
        .collect()
}

pub(crate) fn merge_maps<K, V>(a: &HashMap<K, V>, b: &HashMap<K, V>) -> HashMap<K, V>
where
    K: Eq + Hash + Clone,
    V: Clone,
{
    let mut merged = a.clone();
    merged.extend(b.iter().map(|(k, v)| (k.clone(), v.clone())));
    merged
}
