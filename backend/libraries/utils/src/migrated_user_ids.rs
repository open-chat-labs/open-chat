use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::HashMap;
use types::UserId;

// Maps the id a user had before being migrated to a MultiUser canister to the id they have now.
//
// Each migration is stored as its own entry, and a user migrated more than once is found by
// following their entries through to their latest id. So the map ends up the same whatever order
// the migrations are inserted in, and however many times each one is.
//
// Only `map` is serialized, and `previous` is rebuilt from it when deserializing.
#[derive(Clone, Debug, Default)]
pub struct MigratedUserIds {
    map: HashMap<UserId, UserId>,
    // The reverse of `map`, from each migration's new id to its old id. `insert` never migrates
    // two ids to the same id, so each new id has only one old id.
    previous: HashMap<UserId, UserId>,
}

impl MigratedUserIds {
    // Returns false if nothing was inserted: the migration is already recorded, or it conflicts
    // with one which is, which should never happen since user ids are never reused. That includes
    // another id already having been migrated to `new_user_id`, which would make the two ids'
    // users one and the same.
    pub fn insert(&mut self, old_user_id: UserId, new_user_id: UserId) -> bool {
        if self.map.contains_key(&old_user_id)
            || self.latest(new_user_id) == old_user_id
            || self.previous.contains_key(&new_user_id)
        {
            return false;
        }
        self.map.insert(old_user_id, new_user_id);
        self.previous.insert(new_user_id, old_user_id);
        true
    }

    // Inserts the migrations from each of the user's previous ids, ordered oldest first as
    // returned by `previous_ids`, through to `user_id`
    pub fn insert_previous_ids(&mut self, previous_user_ids: &[UserId], user_id: UserId) {
        let next_ids = previous_user_ids.iter().skip(1).chain([&user_id]);
        for (old_user_id, new_user_id) in previous_user_ids.iter().zip(next_ids) {
            self.insert(*old_user_id, *new_user_id);
        }
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

    // Whether both ids belong to the same user, one having been migrated from the other, or both from
    // a third
    pub fn is_same_user(&self, user_id1: UserId, user_id2: UserId) -> bool {
        user_id1 == user_id2 || (!self.map.is_empty() && self.latest(user_id1) == self.latest(user_id2))
    }

    // Each of the ids the user had before `user_id`, ordered oldest first, found by following
    // their migrations back from `user_id`. Empty if `user_id` was not migrated to.
    pub fn previous_ids(&self, mut user_id: UserId) -> Vec<UserId> {
        let mut previous_ids = Vec::new();
        while let Some(previous) = self.previous.get(&user_id) {
            previous_ids.push(*previous);
            user_id = *previous;
        }
        previous_ids.reverse();
        previous_ids
    }

    // Follows the user's migrations from `user_id` through to their latest id, which is `user_id`
    // itself if they have not been migrated since having it. `insert` never adds a migration which
    // would lead back to an earlier id, so this always ends.
    pub fn latest(&self, mut user_id: UserId) -> UserId {
        while let Some(next) = self.map.get(&user_id) {
            user_id = *next;
        }
        user_id
    }
}

impl Serialize for MigratedUserIds {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.map.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for MigratedUserIds {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let map: HashMap<UserId, UserId> = HashMap::deserialize(deserializer)?;
        let previous = map.iter().map(|(old, new)| (*new, *old)).collect();
        Ok(MigratedUserIds { map, previous })
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
    fn same_user_across_migrations() {
        let mut ids = MigratedUserIds::default();
        ids.insert(user_id(1), user_id(2));
        ids.insert(user_id(2), user_id(3));

        assert!(ids.is_same_user(user_id(1), user_id(3)));
        assert!(ids.is_same_user(user_id(3), user_id(1)));
        assert!(ids.is_same_user(user_id(1), user_id(2)));
        assert!(ids.is_same_user(user_id(4), user_id(4)));
        assert!(!ids.is_same_user(user_id(1), user_id(4)));
        assert_eq!(ids.latest(user_id(1)), user_id(3));
        assert_eq!(ids.latest(user_id(4)), user_id(4));
    }

    #[test]
    fn two_ids_cannot_be_migrated_to_the_same_id() {
        let mut ids = MigratedUserIds::default();

        assert!(ids.insert(user_id(1), user_id(3)));
        assert!(!ids.insert(user_id(2), user_id(3)));

        assert!(!ids.is_same_user(user_id(1), user_id(2)));
        assert_eq!(ids.get(&user_id(2)), None);
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
        assert_eq!(deserialized.previous_ids(user_id(2)), vec![user_id(1)]);
    }

    #[test]
    fn serialized_as_the_map_alone() {
        let mut ids = MigratedUserIds::default();
        ids.insert(user_id(1), user_id(2));

        let bytes = msgpack::serialize_then_unwrap(&ids);
        let map: HashMap<UserId, UserId> = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(map, HashMap::from([(user_id(1), user_id(2))]));
    }

    #[test]
    fn previous_ids_are_ordered_oldest_first() {
        let mut ids = MigratedUserIds::default();
        ids.insert(user_id(2), user_id(3));
        ids.insert(user_id(1), user_id(2));
        ids.insert(user_id(4), user_id(5));

        assert_eq!(ids.previous_ids(user_id(3)), vec![user_id(1), user_id(2)]);
        assert_eq!(ids.previous_ids(user_id(2)), vec![user_id(1)]);
        assert!(ids.previous_ids(user_id(1)).is_empty());
        assert!(ids.previous_ids(user_id(6)).is_empty());
    }

    #[test]
    fn insert_previous_ids_rebuilds_the_migrations() {
        let mut source = MigratedUserIds::default();
        source.insert(user_id(1), user_id(2));
        source.insert(user_id(2), user_id(3));

        let mut ids = MigratedUserIds::default();
        ids.insert_previous_ids(&source.previous_ids(user_id(3)), user_id(3));

        assert_eq!(ids.get(&user_id(1)), Some(user_id(3)));
        assert_eq!(ids.get(&user_id(2)), Some(user_id(3)));
        assert_eq!(ids.previous_ids(user_id(3)), vec![user_id(1), user_id(2)]);
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn insert_previous_ids_with_none_is_a_no_op() {
        let mut ids = MigratedUserIds::default();

        ids.insert_previous_ids(&[], user_id(1));

        assert!(ids.is_empty());
    }
}
