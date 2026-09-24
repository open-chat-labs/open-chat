use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;

// Maps the id a user had before being migrated to a MultiUser canister to the id they have now.
//
// A user migrated more than once is always mapped straight to their latest id, so every lookup
// takes a single step, whichever of their earlier ids it starts from.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(transparent)]
pub struct MigratedUserIds {
    map: HashMap<UserId, UserId>,
}

impl MigratedUserIds {
    // Returns false if the migration was already recorded, so a repeated event is a no-op
    pub fn insert(&mut self, old_user_id: UserId, new_user_id: UserId) -> bool {
        if old_user_id == new_user_id || self.map.get(&old_user_id) == Some(&new_user_id) {
            return false;
        }

        // Point the user's earlier ids, which currently map to `old_user_id`, at their new id
        for user_id in self.map.values_mut() {
            if *user_id == old_user_id {
                *user_id = new_user_id;
            }
        }
        self.map.insert(old_user_id, new_user_id);
        true
    }

    pub fn get(&self, old_user_id: &UserId) -> Option<UserId> {
        self.map.get(old_user_id).copied()
    }

    pub fn iter(&self) -> impl Iterator<Item = (UserId, UserId)> + '_ {
        self.map.iter().map(|(old, new)| (*old, *new))
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
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
        assert_eq!(ids.len(), 2);
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
