use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;

// Maps the id a user had before being migrated to a MultiUser canister to the id they have now.
//
// Each migration is stored as its own entry, and a user migrated more than once is found by
// following their entries through to their latest id. So the map ends up the same whatever order
// the migrations are inserted in, and however many times each one is.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(transparent)]
pub struct MigratedUserIds {
    map: HashMap<UserId, UserId>,
}

impl MigratedUserIds {
    // Returns false if nothing was inserted: the migration is already recorded, or it conflicts
    // with one which is, which should never happen since user ids are never reused
    pub fn insert(&mut self, old_user_id: UserId, new_user_id: UserId) -> bool {
        if self.map.contains_key(&old_user_id) || self.latest(new_user_id) == old_user_id {
            return false;
        }
        self.map.insert(old_user_id, new_user_id);
        true
    }

    // The user's latest id, if they have been migrated since having `old_user_id`
    pub fn get(&self, old_user_id: &UserId) -> Option<UserId> {
        self.map.contains_key(old_user_id).then(|| self.latest(*old_user_id))
    }

    // The latest id of each of the given users who has been migrated, keyed by the id given for
    // them. Users who have not been migrated are left out.
    pub fn get_many(&self, user_ids: impl IntoIterator<Item = UserId>) -> HashMap<UserId, UserId> {
        user_ids
            .into_iter()
            .filter_map(|user_id| self.get(&user_id).map(|latest| (user_id, latest)))
            .collect()
    }

    // Each migration, from which the whole map can be rebuilt by inserting them in any order
    pub fn iter(&self) -> impl Iterator<Item = (UserId, UserId)> + '_ {
        self.map.iter().map(|(old, new)| (*old, *new))
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    // Follows the user's migrations from `user_id` through to their latest id. `insert` never
    // adds a migration which would lead back to an earlier id, so this always ends.
    fn latest(&self, mut user_id: UserId) -> UserId {
        while let Some(next) = self.map.get(&user_id) {
            user_id = *next;
        }
        user_id
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
    fn insert_then_get() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(1), user_id(2)));
        assert_eq!(ids.get(&user_id(1)), Some(user_id(2)));
        assert_eq!(ids.get(&user_id(2)), None);
        assert_eq!(ids.len(), 1);
    }

    #[test]
    fn get_many_returns_only_migrated_users() {
        let mut ids = MigratedUserIds::default();
        ids.insert(user_id(1), user_id(2));
        ids.insert(user_id(2), user_id(3));
        ids.insert(user_id(4), user_id(5));

        let result = ids.get_many([user_id(1), user_id(3), user_id(4), user_id(6)]);

        assert_eq!(result, HashMap::from([(user_id(1), user_id(3)), (user_id(4), user_id(5))]));
    }

    #[test]
    fn repeated_insert_is_a_no_op() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(1), user_id(2)));
        assert!(!ids.insert(user_id(1), user_id(2)));
        assert_eq!(ids.len(), 1);
    }

    #[test]
    fn mapping_to_the_same_id_is_ignored() {
        let mut ids = MigratedUserIds::default();

        assert!(!ids.insert(user_id(1), user_id(1)));
        assert!(ids.is_empty());
    }

    #[test]
    fn earlier_ids_map_to_the_latest_id() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(1), user_id(2)));
        assert!(ids.insert(user_id(2), user_id(3)));

        assert_eq!(ids.get(&user_id(1)), Some(user_id(3)));
        assert_eq!(ids.get(&user_id(2)), Some(user_id(3)));
        assert_eq!(ids.get(&user_id(3)), None);
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn order_of_inserts_does_not_matter() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(2), user_id(3)));
        assert!(ids.insert(user_id(1), user_id(2)));

        assert_eq!(ids.get(&user_id(1)), Some(user_id(3)));
        assert_eq!(ids.get(&user_id(2)), Some(user_id(3)));
    }

    #[test]
    fn repeating_an_earlier_migration_is_a_no_op() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(1), user_id(2)));
        assert!(ids.insert(user_id(2), user_id(3)));
        assert!(!ids.insert(user_id(1), user_id(2)));

        assert_eq!(ids.get(&user_id(1)), Some(user_id(3)));
    }

    #[test]
    fn conflicting_migration_is_ignored() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(1), user_id(2)));
        assert!(!ids.insert(user_id(1), user_id(3)));

        assert_eq!(ids.get(&user_id(1)), Some(user_id(2)));
    }

    #[test]
    fn migration_leading_back_to_an_earlier_id_is_ignored() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(1), user_id(2)));
        assert!(ids.insert(user_id(2), user_id(3)));
        assert!(!ids.insert(user_id(3), user_id(1)));

        assert_eq!(ids.get(&user_id(1)), Some(user_id(3)));
        assert_eq!(ids.get(&user_id(3)), None);
    }

    #[test]
    fn rebuilt_from_iter_in_any_order() {
        let mut ids = MigratedUserIds::default();
        ids.insert(user_id(1), user_id(2));
        ids.insert(user_id(2), user_id(3));
        ids.insert(user_id(4), user_id(5));

        let mut entries: Vec<_> = ids.iter().collect();
        entries.sort();
        entries.reverse();

        let mut rebuilt = MigratedUserIds::default();
        for (old, new) in entries {
            assert!(rebuilt.insert(old, new));
        }

        for i in 1..=5 {
            assert_eq!(rebuilt.get(&user_id(i)), ids.get(&user_id(i)));
        }
    }

    #[test]
    fn round_trips_through_msgpack() {
        let mut ids = MigratedUserIds::default();
        ids.insert(user_id(1), user_id(2));

        let bytes = msgpack::serialize_then_unwrap(&ids);
        let deserialized: MigratedUserIds = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(deserialized.get(&user_id(1)), Some(user_id(2)));
    }
}
