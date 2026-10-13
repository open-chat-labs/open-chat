use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};
use tracing::error;
use types::UserId;
use utils::migrated_user_ids::MigratedUserIds;

// The progress of the job which replaces the ids users had before being migrated to MultiUser
// canisters with their latest ids, throughout a group's or community's state other than its events
// (which `UserIdsInEventsMigration` covers), so that the state no longer needs reading through the
// canister's `MigratedUserIds`.
//
// The job passes through the state a step at a time, `P` being where it has got to. An id held as a
// value (eg. who created the chat) is replaced as it is passed if `MigratedUserIds` has its
// migration. An id under which a record is held (eg. a membership) is queued in `to_move`, so that
// the record can be moved onto the latest id once the step has finished reading. Any other id
// which carries no index, as the id of a User canister didn't, and which `MigratedUserIds` doesn't
// know, may be one a user was migrated from, so is recorded to be looked up in the LocalUserIndex.
// Once a pass has finished, those ids are looked up, adding any migrations found to
// `MigratedUserIds`, then another pass is made to replace them. The job is complete once a pass
// finds nothing to look up. Each id is only looked up once.
//
// A value is never replaced by the latest id while records are still held under the old id (eg. a
// principal mapped to a member who hasn't been moved yet), since the value would then lead nowhere.
// That can only happen if the migration was learned during the pass, after the records had been
// passed, eg. by events for the user being sent on to their latest id. Such a value is deferred, and
// another pass is made, which moves the records and then replaces it.
#[derive(Serialize, Deserialize)]
#[serde(bound(serialize = "P: Serialize", deserialize = "P: Deserialize<'de>"))]
pub struct UserIdsInStateMigration<P> {
    #[serde(rename = "s", default)]
    phase: Phase<P>,
    #[serde(rename = "p", default, skip_serializing_if = "BTreeSet::is_empty")]
    to_look_up: BTreeSet<UserId>,
    // The ids under which records are held which are waiting to be moved onto the latest ids
    #[serde(rename = "m", default, skip_serializing_if = "BTreeSet::is_empty")]
    to_move: BTreeSet<UserId>,
    // The ids which have been looked up and found not to have been migrated
    #[serde(rename = "n", default, skip_serializing_if = "HashSet::is_empty")]
    not_migrated: HashSet<UserId>,
    // Whether the current pass has deferred anything (see `defer`)
    #[serde(rename = "d", default)]
    another_pass_needed: bool,
    #[serde(rename = "c", default)]
    passes_completed: u32,
    #[serde(rename = "l", default)]
    user_ids_looked_up: u32,
    // How many ids held as values have been replaced
    #[serde(rename = "r", default)]
    user_ids_replaced: u64,
    // How many ids had records moved off them
    #[serde(rename = "v", default)]
    user_ids_moved: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(bound(serialize = "P: Serialize", deserialize = "P: Deserialize<'de>"))]
enum Phase<P> {
    // Passing through the state, having got to the position held, None before the first step
    #[serde(rename = "p")]
    Pass(Option<P>),
    // Looking up the ids found by the last pass
    #[serde(rename = "l")]
    LookUp,
    #[serde(rename = "c")]
    Complete,
}

impl<P> Default for Phase<P> {
    fn default() -> Self {
        Phase::Pass(None)
    }
}

impl<P> Default for UserIdsInStateMigration<P> {
    fn default() -> Self {
        UserIdsInStateMigration {
            phase: Phase::default(),
            to_look_up: BTreeSet::new(),
            to_move: BTreeSet::new(),
            not_migrated: HashSet::new(),
            another_pass_needed: false,
            passes_completed: 0,
            user_ids_looked_up: 0,
            user_ids_replaced: 0,
            user_ids_moved: 0,
        }
    }
}

impl<P: Copy> UserIdsInStateMigration<P> {
    pub fn is_complete(&self) -> bool {
        matches!(self.phase, Phase::Complete)
    }

    // Where the current pass has got to, None before its first step. None if not passing through
    // the state.
    pub fn pass_position(&self) -> Option<Option<P>> {
        if let Phase::Pass(position) = self.phase { Some(position) } else { None }
    }

    // Records where a step got to, None meaning the pass has finished, after which the ids it found
    // are looked up, if there are any, then another pass is made if needed, otherwise the job is
    // complete
    pub fn record_position(&mut self, position: Option<P>) {
        if position.is_some() {
            self.phase = Phase::Pass(position);
        } else {
            self.passes_completed += 1;
            let another_pass_needed = std::mem::take(&mut self.another_pass_needed);
            if !self.to_look_up.is_empty() {
                self.phase = Phase::LookUp;
            } else if another_pass_needed {
                self.phase = Phase::Pass(None);
            } else {
                self.phase = Phase::Complete;
                // The ids found not to have been migrated are only needed while passing
                self.not_migrated = HashSet::new();
            }
        }
    }

    // Passes through the state again, from the start, for when ids which may not be latest ids are
    // added to it, eg. a group imported into a community
    pub fn restart(&mut self) {
        self.phase = Phase::Pass(None);
        self.to_move.clear();
        self.another_pass_needed = false;
    }

    // What to replace `user_id`, held as a value, with: the user's latest id if they are known to
    // have been migrated, otherwise `user_id` itself, which is recorded to be looked up if it may be
    // one a user was migrated from
    pub fn latest_user_id(&mut self, user_id: UserId, migrated_user_ids: &MigratedUserIds) -> UserId {
        if let Some(latest) = migrated_user_ids.get(&user_id) {
            self.user_ids_replaced += 1;
            latest
        } else {
            self.look_up_if_unknown(user_id, migrated_user_ids);
            user_id
        }
    }

    // Records an id under which a record is held, which is queued to be moved onto the user's latest
    // id if they are known to have been migrated, otherwise recorded to be looked up if it may be one
    // a user was migrated from
    pub fn record_key(&mut self, user_id: UserId, migrated_user_ids: &MigratedUserIds) {
        if migrated_user_ids.get(&user_id).is_some() {
            self.to_move.insert(user_id);
        } else {
            self.look_up_if_unknown(user_id, migrated_user_ids);
        }
    }

    // Leaves `user_id` as it is for now, because records are still held under it elsewhere, which
    // the pass has already gone by if it is known to have been migrated. Another pass is then made,
    // which moves those records before replacing it.
    pub fn defer(&mut self, user_id: UserId, migrated_user_ids: &MigratedUserIds) {
        if migrated_user_ids.get(&user_id).is_some() {
            self.another_pass_needed = true;
        } else {
            self.look_up_if_unknown(user_id, migrated_user_ids);
        }
    }

    // Takes the next of the ids whose records are waiting to be moved
    pub fn take_next_to_move(&mut self) -> Option<UserId> {
        self.to_move.pop_first()
    }

    // Drops the ids waiting to be moved, eg. once the channel holding their records has been deleted
    pub fn clear_to_move(&mut self) {
        self.to_move.clear();
    }

    pub fn record_moved(&mut self) {
        self.user_ids_moved += 1;
    }

    // Up to `max_count` of the ids waiting to be looked up in the LocalUserIndex
    pub fn user_ids_to_look_up(&self, max_count: usize) -> Vec<UserId> {
        if matches!(self.phase, Phase::LookUp) {
            self.to_look_up.iter().take(max_count).copied().collect()
        } else {
            Vec::new()
        }
    }

    // Records the result of looking up `user_ids`, `migrated` holding the latest id of each of them
    // which has been migrated, and adds those migrations to `migrated_user_ids`. Once every id has
    // been looked up, another pass is started to replace them.
    pub fn record_lookup(
        &mut self,
        user_ids: &[UserId],
        migrated: &HashMap<UserId, UserId>,
        migrated_user_ids: &mut MigratedUserIds,
    ) {
        for user_id in user_ids {
            if !self.to_look_up.remove(user_id) {
                continue;
            }
            self.user_ids_looked_up += 1;
            if let Some(&latest) = migrated.get(user_id)
                && !migrated_user_ids.insert(*user_id, latest)
                && migrated_user_ids.get(user_id).is_none()
            {
                // Should never happen, since it means another id has already been migrated to `latest`
                error!(?user_id, ?latest, "Failed to record user id migration");
            }
            if migrated_user_ids.get(user_id).is_none() {
                self.not_migrated.insert(*user_id);
            }
        }
        if self.to_look_up.is_empty() && matches!(self.phase, Phase::LookUp) {
            self.phase = Phase::Pass(None);
        }
    }

    pub fn metrics(&self) -> UserIdsInStateMigrationMetrics {
        UserIdsInStateMigrationMetrics {
            complete: self.is_complete(),
            passes_completed: self.passes_completed,
            user_ids_to_look_up: self.to_look_up.len() as u32,
            user_ids_looked_up: self.user_ids_looked_up,
            user_ids_not_migrated: self.not_migrated.len() as u32,
            user_ids_replaced: self.user_ids_replaced,
            user_ids_moved: self.user_ids_moved,
        }
    }

    fn look_up_if_unknown(&mut self, user_id: UserId, migrated_user_ids: &MigratedUserIds) {
        if !user_id.is_indexed() && !migrated_user_ids.contains(&user_id) && !self.not_migrated.contains(&user_id) {
            self.to_look_up.insert(user_id);
        }
    }
}

#[derive(Serialize, Debug)]
pub struct UserIdsInStateMigrationMetrics {
    pub complete: bool,
    pub passes_completed: u32,
    pub user_ids_to_look_up: u32,
    pub user_ids_looked_up: u32,
    pub user_ids_not_migrated: u32,
    pub user_ids_replaced: u64,
    pub user_ids_moved: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::CanisterId;

    // An id which carries no index, as the id of a User canister didn't
    fn old_user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn new_user_id(i: u8) -> UserId {
        UserId::new_indexed(CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, 1, 1, 1]), i as u16)
    }

    #[test]
    fn known_migrations_are_applied_and_unknown_unindexed_ids_looked_up() {
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(old_user_id(1), new_user_id(1));
        let mut migration = UserIdsInStateMigration::<u32>::default();

        // Values with known migrations are replaced, records under them queued to be moved
        assert_eq!(migration.latest_user_id(old_user_id(1), &migrated_user_ids), new_user_id(1));
        migration.record_key(old_user_id(1), &migrated_user_ids);
        // Latest ids, whether known or indexed, needn't be looked up
        assert_eq!(migration.latest_user_id(new_user_id(1), &migrated_user_ids), new_user_id(1));
        migration.record_key(new_user_id(2), &migrated_user_ids);
        // Unknown unindexed ids are
        assert_eq!(migration.latest_user_id(old_user_id(2), &migrated_user_ids), old_user_id(2));
        migration.record_key(old_user_id(3), &migrated_user_ids);

        assert_eq!(migration.take_next_to_move(), Some(old_user_id(1)));
        assert_eq!(migration.take_next_to_move(), None);
        migration.record_moved();
        // Nothing is looked up until the pass has finished
        assert!(migration.user_ids_to_look_up(10).is_empty());
        migration.record_position(Some(5));
        assert_eq!(migration.pass_position(), Some(Some(5)));
        migration.record_position(None);
        assert_eq!(migration.pass_position(), None);
        assert_eq!(migration.user_ids_to_look_up(10), vec![old_user_id(2), old_user_id(3)]);

        // User 2 has been migrated, user 3 hasn't
        migration.record_lookup(
            &[old_user_id(2)],
            &HashMap::from([(old_user_id(2), new_user_id(2))]),
            &mut migrated_user_ids,
        );
        assert_eq!(migration.user_ids_to_look_up(10), vec![old_user_id(3)]);
        migration.record_lookup(&[old_user_id(3)], &HashMap::new(), &mut migrated_user_ids);
        assert_eq!(migrated_user_ids.get(&old_user_id(2)), Some(new_user_id(2)));

        // Another pass is made to replace the ids found to have been migrated, during which the id
        // found not to have been migrated isn't looked up again
        assert_eq!(migration.pass_position(), Some(None));
        assert_eq!(migration.latest_user_id(old_user_id(2), &migrated_user_ids), new_user_id(2));
        migration.record_key(old_user_id(3), &migrated_user_ids);
        migration.record_position(None);

        assert!(migration.is_complete());
        let metrics = migration.metrics();
        assert_eq!(metrics.passes_completed, 2);
        assert_eq!(metrics.user_ids_looked_up, 2);
        assert_eq!(metrics.user_ids_replaced, 2);
        assert_eq!(metrics.user_ids_moved, 1);
        // The ids found not to have been migrated are dropped once complete
        assert_eq!(metrics.user_ids_not_migrated, 0);
    }

    #[test]
    fn deferring_an_id_with_a_known_migration_makes_another_pass() {
        let mut migrated_user_ids = MigratedUserIds::default();
        let mut migration = UserIdsInStateMigration::<u32>::default();

        // A latest id, or one found not to have been migrated, needs nothing more
        migration.defer(new_user_id(1), &migrated_user_ids);
        migration.record_position(None);
        assert!(migration.is_complete());

        migration.restart();
        migrated_user_ids.insert(old_user_id(1), new_user_id(1));
        migration.defer(old_user_id(1), &migrated_user_ids);
        migration.record_position(None);

        assert_eq!(migration.pass_position(), Some(None));
        assert!(migration.user_ids_to_look_up(10).is_empty());
        // The next pass has nothing left to defer
        migration.record_position(None);
        assert!(migration.is_complete());
        assert_eq!(migration.metrics().passes_completed, 3);
    }

    #[test]
    fn deferring_an_unknown_unindexed_id_looks_it_up() {
        let migrated_user_ids = MigratedUserIds::default();
        let mut migration = UserIdsInStateMigration::<u32>::default();

        migration.defer(old_user_id(1), &migrated_user_ids);
        migration.record_position(None);

        assert_eq!(migration.user_ids_to_look_up(10), vec![old_user_id(1)]);
    }

    #[test]
    fn restarting_passes_through_the_state_again() {
        let migrated_user_ids = MigratedUserIds::default();
        let mut migration = UserIdsInStateMigration::<u32>::default();
        migration.record_position(None);
        assert!(migration.is_complete());

        migration.restart();
        assert_eq!(migration.pass_position(), Some(None));
        migration.record_position(Some(1));
        migration.record_key(old_user_id(1), &migrated_user_ids);
        migration.restart();

        assert!(!migration.is_complete());
        assert_eq!(migration.pass_position(), Some(None));
        // The ids found so far are still looked up once the pass has finished
        migration.record_position(None);
        assert_eq!(migration.user_ids_to_look_up(10), vec![old_user_id(1)]);
    }

    #[test]
    fn serializes_and_deserializes() {
        let migrated_user_ids = MigratedUserIds::default();
        let mut migration = UserIdsInStateMigration::<u32>::default();
        migration.record_key(old_user_id(1), &migrated_user_ids);
        migration.record_position(Some(3));

        let bytes = msgpack::serialize_then_unwrap(&migration);
        let deserialized: UserIdsInStateMigration<u32> = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(deserialized.pass_position(), Some(Some(3)));
        assert_eq!(deserialized.metrics().user_ids_to_look_up, 1);
    }
}
