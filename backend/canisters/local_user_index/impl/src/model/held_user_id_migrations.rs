use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::UserId;

// The notices of other users' new ids held for users whose canisters are on a wasm older than the
// current User wasm, which are sent once their canisters have been upgraded. User 2.0.2015 doesn't
// know `UserIdMigrated`, and an event a canister can't decode fails the whole batch it's in, which
// holds up every later event to that canister until it's upgraded.
#[derive(Serialize, Deserialize, Default)]
pub struct HeldUserIdMigrations {
    // Each user's held notices, as (old id, new id) pairs, in the order they were held
    by_user: BTreeMap<UserId, Vec<(UserId, UserId)>>,
}

impl HeldUserIdMigrations {
    pub fn hold(&mut self, user_id: UserId, old_user_id: UserId, new_user_id: UserId) {
        let held = self.by_user.entry(user_id).or_default();
        if !held.contains(&(old_user_id, new_user_id)) {
            held.push((old_user_id, new_user_id));
        }
    }

    pub fn take(&mut self, user_id: &UserId) -> Vec<(UserId, UserId)> {
        self.by_user.remove(user_id).unwrap_or_default()
    }

    pub fn len(&self) -> usize {
        self.by_user.values().map(|held| held.len()).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn notices_are_held_per_user_in_order_without_duplicates() {
        let mut held = HeldUserIdMigrations::default();
        held.hold(user_id(1), user_id(10), user_id(11));
        held.hold(user_id(1), user_id(20), user_id(21));
        held.hold(user_id(1), user_id(10), user_id(11));
        held.hold(user_id(2), user_id(10), user_id(11));
        assert_eq!(held.len(), 3);

        assert_eq!(
            held.take(&user_id(1)),
            vec![(user_id(10), user_id(11)), (user_id(20), user_id(21))]
        );
        assert!(held.take(&user_id(1)).is_empty());
        assert_eq!(held.len(), 1);
    }
}
