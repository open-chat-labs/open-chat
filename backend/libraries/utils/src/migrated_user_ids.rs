use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;

// Maps the id a user had before being migrated to a MultiUser canister to the id they have now.
//
// Each migration is stored as its own entry, and a user migrated more than once is found by
// following their entries through to their latest id. So the map ends up the same whatever order
// the migrations are inserted in, and however many times each one is.
//
// Only the migrations themselves are serialized. The index of each user's earlier ids by their
// latest id is rebuilt from them when deserialized.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(from = "HashMap<UserId, UserId>", into = "HashMap<UserId, UserId>")]
pub struct MigratedUserIds {
    map: HashMap<UserId, UserId>,
    previous_ids: HashMap<UserId, Vec<UserId>>,
}

impl MigratedUserIds {
    // Returns false if nothing was inserted: the migration is already recorded, or it conflicts
    // with one which is, which should never happen since user ids are never reused
    pub fn insert(&mut self, old_user_id: UserId, new_user_id: UserId) -> bool {
        let latest = self.latest(new_user_id);
        if self.map.contains_key(&old_user_id) || latest == old_user_id {
            return false;
        }
        self.map.insert(old_user_id, new_user_id);

        // The user's ids which led to `old_user_id`, and it too, now lead to their latest id
        let mut previous_ids = self.previous_ids.remove(&old_user_id).unwrap_or_default();
        previous_ids.push(old_user_id);
        self.previous_ids.entry(latest).or_default().extend(previous_ids);
        true
    }

    // The user's latest id, if they have been migrated since having `old_user_id`
    pub fn get(&self, old_user_id: &UserId) -> Option<UserId> {
        self.map.contains_key(old_user_id).then(|| self.latest(*old_user_id))
    }

    // The earlier ids of the user whose latest id is `user_id`, so empty unless they have been migrated
    pub fn previous_ids(&self, user_id: UserId) -> Vec<UserId> {
        self.previous_ids.get(&user_id).cloned().unwrap_or_default()
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

impl From<HashMap<UserId, UserId>> for MigratedUserIds {
    fn from(map: HashMap<UserId, UserId>) -> Self {
        let mut ids = MigratedUserIds::default();
        for (old_user_id, new_user_id) in map {
            ids.insert(old_user_id, new_user_id);
        }
        ids
    }
}

impl From<MigratedUserIds> for HashMap<UserId, UserId> {
    fn from(ids: MigratedUserIds) -> Self {
        ids.map
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
    fn previous_ids_of_the_latest_id() {
        let mut ids = MigratedUserIds::default();
        ids.insert(user_id(1), user_id(2));
        ids.insert(user_id(2), user_id(3));
        ids.insert(user_id(4), user_id(5));

        let mut previous = ids.previous_ids(user_id(3));
        previous.sort();
        assert_eq!(previous, vec![user_id(1), user_id(2)]);
        assert!(ids.previous_ids(user_id(2)).is_empty());
        assert!(ids.previous_ids(user_id(6)).is_empty());
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

        let mut previous = ids.previous_ids(user_id(3));
        previous.sort();
        assert_eq!(previous, vec![user_id(1), user_id(2)]);
        assert!(ids.previous_ids(user_id(2)).is_empty());
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
        assert_eq!(deserialized.previous_ids(user_id(2)), vec![user_id(1)]);

        // Serialized as the plain map of migrations it was before the index was added
        let bytes_as_map = msgpack::serialize_then_unwrap(HashMap::from([(user_id(1), user_id(2))]));
        assert_eq!(bytes, bytes_as_map);
    }
}
