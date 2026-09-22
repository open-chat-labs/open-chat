//! The query endpoints shared by the User and MultiUser canisters, one function per endpoint

use crate::User;
use std::cmp::Reverse;
use std::collections::HashMap;
use std::hash::Hash;
use types::{Chat, TimestampMillis};

mod chit_events;
mod contacts;
mod deleted_message;
mod initial_state;
mod messages_by_message_index;
mod public_profile;
mod updates;

pub use chit_events::chit_events;
pub use contacts::contacts;
pub use deleted_message::deleted_message;
pub use initial_state::initial_state;
pub use messages_by_message_index::messages_by_message_index;
pub use public_profile::public_profile;
pub use updates::updates;

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
