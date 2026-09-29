use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use types::UserId;

// The users who were members but no longer are, other than deleted users. A user who joins again is
// removed. Recorded so that a user who rejoins under a new id, having been migrated to a MultiUser
// canister, can be recognised as having events under their earlier ids.
#[derive(Serialize, Deserialize, Default)]
#[serde(from = "FormerMembersStored")]
pub struct FormerMembers {
    user_ids: BTreeSet<UserId>,
}

// The builds since #9564 stored the former members as a bare set, and Group and Community may be
// released from one of those, so that shape is read too
// TODO: Remove `Set` once Group and Community have been released with `FormerMembers`
#[derive(Deserialize)]
#[serde(untagged)]
enum FormerMembersStored {
    Current { user_ids: BTreeSet<UserId> },
    Set(BTreeSet<UserId>),
}

impl From<FormerMembersStored> for FormerMembers {
    fn from(value: FormerMembersStored) -> Self {
        match value {
            FormerMembersStored::Current { user_ids } | FormerMembersStored::Set(user_ids) => FormerMembers { user_ids },
        }
    }
}

impl FormerMembers {
    pub fn contains(&self, user_id: &UserId) -> bool {
        self.user_ids.contains(user_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = UserId> + '_ {
        self.user_ids.iter().copied()
    }

    pub fn on_member_added(&mut self, user_id: UserId) {
        self.user_ids.remove(&user_id);
    }

    // A deleted user never rejoins, so isn't recorded
    pub fn on_member_removed(&mut self, user_id: UserId, user_deleted: bool) {
        if user_deleted {
            self.user_ids.remove(&user_id);
        } else {
            self.user_ids.insert(user_id);
        }
    }

    // Records a user who was a member elsewhere, eg. of a group imported into a community, and who
    // isn't a member here
    pub fn record(&mut self, user_id: UserId) {
        self.user_ids.insert(user_id);
    }

    // Moves a former member onto the new id they were given when migrated to a MultiUser canister,
    // unless they are a member under it. Returns whether they were a former member under their old id.
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, is_member: bool) -> bool {
        let was_former_member = self.user_ids.remove(&old_user_id);
        if is_member {
            self.user_ids.remove(&new_user_id);
        } else if was_former_member {
            self.user_ids.insert(new_user_id);
        }
        was_former_member
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn members_who_leave_are_recorded_until_they_rejoin() {
        let mut former_members = FormerMembers::default();

        former_members.on_member_removed(user_id(1), false);
        former_members.on_member_removed(user_id(2), true);

        assert!(former_members.contains(&user_id(1)));
        assert!(!former_members.contains(&user_id(2)), "deleted users aren't recorded");

        former_members.on_member_added(user_id(1));

        assert!(!former_members.contains(&user_id(1)));
    }

    #[test]
    fn deleted_user_is_dropped_even_if_already_recorded() {
        let mut former_members = FormerMembers::default();
        former_members.record(user_id(1));

        former_members.on_member_removed(user_id(1), true);

        assert!(!former_members.contains(&user_id(1)));
    }

    #[test]
    fn migrated_former_member_is_moved_to_their_new_id() {
        let mut former_members = FormerMembers::default();
        former_members.record(user_id(1));

        assert!(former_members.migrate_user_id(user_id(1), user_id(2), false));

        assert!(!former_members.contains(&user_id(1)));
        assert!(former_members.contains(&user_id(2)));
    }

    #[test]
    fn migrated_former_member_who_is_a_member_under_their_new_id_is_dropped() {
        let mut former_members = FormerMembers::default();
        former_members.record(user_id(1));
        former_members.record(user_id(2));

        assert!(former_members.migrate_user_id(user_id(1), user_id(2), true));

        assert_eq!(former_members.iter().count(), 0);
    }

    #[test]
    fn migrated_member_is_dropped_under_their_new_id() {
        let mut former_members = FormerMembers::default();
        former_members.record(user_id(2));

        assert!(!former_members.migrate_user_id(user_id(1), user_id(2), true));

        assert_eq!(former_members.iter().count(), 0);
    }

    #[test]
    fn migrating_a_user_who_isnt_a_former_member_changes_nothing() {
        let mut former_members = FormerMembers::default();
        former_members.record(user_id(3));

        assert!(!former_members.migrate_user_id(user_id(1), user_id(2), false));

        assert_eq!(former_members.iter().collect::<Vec<_>>(), vec![user_id(3)]);
    }

    #[test]
    fn deserializes_from_the_current_and_the_previous_shape() {
        let mut former_members = FormerMembers::default();
        former_members.record(user_id(1));

        let current: FormerMembers = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&former_members));
        let previous: FormerMembers =
            msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(BTreeSet::from([user_id(1)])));
        let previous_empty: FormerMembers =
            msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(BTreeSet::<UserId>::new()));

        assert_eq!(current.iter().collect::<Vec<_>>(), vec![user_id(1)]);
        assert_eq!(previous.iter().collect::<Vec<_>>(), vec![user_id(1)]);
        assert_eq!(previous_empty.iter().count(), 0);
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }
}
