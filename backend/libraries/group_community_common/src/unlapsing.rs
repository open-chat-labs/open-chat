use serde::{Deserialize, Serialize};
use types::{TimestampMillis, UserId};

// Set while the lapsed members of a chat or community are unlapsed, a batch at a time, because its
// access gate has been removed. Those who lapsed at or before `before`, when the gate was removed,
// are unlapsed, in order of user id; those up to and including `after` have been. Anyone who lapses
// after `before` has lapsed under an access gate set since, so is left lapsed.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Unlapsing {
    pub before: TimestampMillis,
    pub after: Option<UserId>,
}
