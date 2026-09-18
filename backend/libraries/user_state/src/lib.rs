//! The per-user state shared by the User canister, which holds a single user, and the MultiUser
//! canister, which holds many. Each model is the same in both: the entries a model keeps in the
//! stable memory map are scoped to the user they belong to at the boundary of the map, so the
//! MultiUser canister only has to access a model within its user's key scope.

use std::cmp::Reverse;
use std::collections::HashMap;
use std::hash::Hash;
use types::TimestampMillis;

mod blocked_users;
mod contacts;
mod favourite_chats;
mod hot_group_exclusions;
mod message_activity_events;
mod pin_number;
mod profile_document;
mod saved_crypto_accounts;

pub use blocked_users::BlockedUsers;
pub use contacts::{Contact, Contacts, SetContactResponse};
pub use favourite_chats::FavouriteChats;
pub use hot_group_exclusions::HotGroupExclusions;
pub use message_activity_events::MessageActivityEvents;
pub use pin_number::{PinNumber, VerifyPinError};
pub use profile_document::ProfileDocument;
pub use saved_crypto_accounts::SavedCryptoAccounts;

// The keys of `map`, whose values are when each was pinned, most recently pinned first
pub fn sorted_pinned<T: Clone>(map: &HashMap<T, TimestampMillis>) -> Vec<T> {
    use itertools::Itertools;

    map.iter()
        .map(|(key, &ts)| (key.clone(), ts))
        .sorted_by_key(|(_, ts)| Reverse(*ts))
        .map(|(key, _)| key)
        .collect()
}

pub fn merge_maps<K, V>(a: &HashMap<K, V>, b: &HashMap<K, V>) -> HashMap<K, V>
where
    K: Eq + Hash + Clone,
    V: Clone,
{
    let mut merged = a.clone();
    merged.extend(b.iter().map(|(k, v)| (k.clone(), v.clone())));
    merged
}
