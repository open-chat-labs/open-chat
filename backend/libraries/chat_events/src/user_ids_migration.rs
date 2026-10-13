use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::hash::Hash;
use tracing::error;
use types::UserId;
use utils::migrated_user_ids::MigratedUserIds;

// The progress of the job which replaces the ids users had before being migrated to MultiUser
// canisters with their latest ids, in every event the canister holds, so that the events no longer
// need reading through the canister's `MigratedUserIds`.
//
// The events are scanned in batches, each carrying on from the event the last one stopped at (`L`
// being where an event is within the canister). An id is replaced as it is scanned if
// `MigratedUserIds` has its migration. Any other id, unless `MigratedUserIds` has it as a user's
// latest id, is looked up in the LocalUserIndex, so is recorded along with the events it is in.
// Once looked up, the events of any which have been migrated are queued to be updated, in batches
// of their own. Each id is only looked up once.
#[derive(Serialize, Deserialize)]
#[serde(bound(serialize = "L: Serialize", deserialize = "L: Deserialize<'de>"))]
pub struct UserIdsInEventsMigration<L> {
    #[serde(rename = "a", default, skip_serializing_if = "Option::is_none")]
    scanned_up_to: Option<L>,
    #[serde(rename = "s", default)]
    scan_complete: bool,
    #[serde(rename = "p", default)]
    to_look_up: BTreeMap<UserId, Vec<L>>,
    // The events of the ids which have been looked up and found to have been migrated
    #[serde(rename = "e", default)]
    to_update: Vec<L>,
    // The ids which have been looked up and found not to have been migrated
    #[serde(rename = "l", default)]
    not_migrated: HashSet<UserId>,
    // The number of times an event has been written back with ids replaced, which counts an event
    // updated both while being scanned and after a lookup twice
    #[serde(rename = "u", default)]
    events_updated: u64,
    // The event in which an id was last replaced while scanning, so that each event is only counted
    // once in `events_updated`
    #[serde(skip)]
    last_updated: Option<L>,
}

impl<L> Default for UserIdsInEventsMigration<L> {
    fn default() -> Self {
        UserIdsInEventsMigration {
            scanned_up_to: None,
            scan_complete: false,
            to_look_up: BTreeMap::new(),
            to_update: Vec::new(),
            not_migrated: HashSet::new(),
            events_updated: 0,
            last_updated: None,
        }
    }
}

impl<L: Copy + Eq + Hash> UserIdsInEventsMigration<L> {
    pub fn is_complete(&self) -> bool {
        self.scan_complete && self.to_look_up.is_empty() && self.to_update.is_empty()
    }

    pub fn is_scan_complete(&self) -> bool {
        self.scan_complete
    }

    // Whether any events have been scanned
    pub fn has_started(&self) -> bool {
        self.scanned_up_to.is_some() || self.scan_complete
    }

    // The last event scanned, from which the next batch carries on. None before the first batch.
    pub fn scanned_up_to(&self) -> Option<L> {
        self.scanned_up_to
    }

    // Records the last event scanned by a batch, None meaning there were no more to scan
    pub fn record_scanned_up_to(&mut self, scanned_up_to: Option<L>) {
        self.scanned_up_to = scanned_up_to;
        if scanned_up_to.is_none() {
            self.scan_complete = true;
            self.tidy_if_complete();
        }
    }

    // Scans every event again, for when events which haven't been scanned are added somewhere the
    // scan has already passed, eg. a group imported into a community
    pub fn restart_scan(&mut self) {
        self.scanned_up_to = None;
        self.scan_complete = false;
    }

    // What to replace `user_id` with in the event at `location`: the user's latest id if they are
    // known to have been migrated, otherwise `user_id` itself, which unless it is known to be a
    // latest id is recorded to be looked up, along with the event
    pub fn latest_user_id(&mut self, user_id: UserId, location: L, migrated_user_ids: &MigratedUserIds) -> UserId {
        if let Some(latest) = migrated_user_ids.get(&user_id) {
            if self.last_updated != Some(location) {
                self.last_updated = Some(location);
                self.events_updated += 1;
            }
            latest
        } else {
            if !migrated_user_ids.contains(&user_id) && !self.not_migrated.contains(&user_id) {
                let locations = self.to_look_up.entry(user_id).or_default();
                if locations.last() != Some(&location) {
                    locations.push(location);
                }
            }
            user_id
        }
    }

    // Up to `max_count` of the ids waiting to be looked up in the LocalUserIndex
    pub fn user_ids_to_look_up(&self, max_count: usize) -> Vec<UserId> {
        self.to_look_up.keys().take(max_count).copied().collect()
    }

    // Records the result of looking up `user_ids`, `migrated` holding the latest id of each of them
    // which has been migrated, adds those migrations to `migrated_user_ids` and queues the events in
    // which they were found to be updated
    pub fn record_lookup(
        &mut self,
        user_ids: &[UserId],
        migrated: &HashMap<UserId, UserId>,
        migrated_user_ids: &mut MigratedUserIds,
    ) {
        let mut seen = HashSet::new();
        for user_id in user_ids {
            let Some(locations) = self.to_look_up.remove(user_id) else {
                continue;
            };
            if let Some(&latest) = migrated.get(user_id)
                && !migrated_user_ids.insert(*user_id, latest)
                && migrated_user_ids.get(user_id).is_none()
            {
                // Should never happen, since it means another id has already been migrated to `latest`
                error!(?user_id, ?latest, "Failed to record user id migration");
            }
            if migrated_user_ids.get(user_id).is_some() {
                self.to_update.extend(locations.into_iter().filter(|l| seen.insert(*l)));
            } else {
                self.not_migrated.insert(*user_id);
            }
        }
        self.tidy_if_complete();
    }

    pub fn has_events_to_update(&self) -> bool {
        !self.to_update.is_empty()
    }

    // Takes up to `max_count` of the events queued to be updated
    pub fn take_events_to_update(&mut self, max_count: usize) -> Vec<L> {
        let events = self.to_update.split_off(self.to_update.len().saturating_sub(max_count));
        self.tidy_if_complete();
        events
    }

    pub fn record_events_updated(&mut self, count: u32) {
        self.events_updated += u64::from(count);
    }

    pub fn metrics(&self) -> UserIdsInEventsMigrationMetrics {
        UserIdsInEventsMigrationMetrics {
            complete: self.is_complete(),
            scan_complete: self.scan_complete,
            events_updated: self.events_updated,
            user_ids_to_look_up: self.to_look_up.len() as u32,
            events_to_update: self.to_update.len() as u32,
            user_ids_not_migrated: self.not_migrated.len() as u32,
        }
    }

    // The ids found not to have been migrated are only needed while scanning
    fn tidy_if_complete(&mut self) {
        if self.is_complete() {
            self.not_migrated = HashSet::new();
        }
    }
}

#[derive(Serialize, Debug)]
pub struct UserIdsInEventsMigrationMetrics {
    pub complete: bool,
    pub scan_complete: bool,
    pub events_updated: u64,
    pub user_ids_to_look_up: u32,
    pub events_to_update: u32,
    pub user_ids_not_migrated: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn known_migrations_are_applied_and_other_ids_looked_up() {
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(user_id(1), user_id(11));
        let mut migration = UserIdsInEventsMigration::<u32>::default();

        // A known migration is applied straight away, and the event counted once
        assert_eq!(migration.latest_user_id(user_id(1), 0, &migrated_user_ids), user_id(11));
        assert_eq!(migration.latest_user_id(user_id(1), 0, &migrated_user_ids), user_id(11));
        // A latest id needn't be looked up
        assert_eq!(migration.latest_user_id(user_id(11), 0, &migrated_user_ids), user_id(11));
        // Anything else is, along with each event it is in
        for location in [0, 1, 1, 2] {
            assert_eq!(migration.latest_user_id(user_id(2), location, &migrated_user_ids), user_id(2));
        }
        assert_eq!(migration.latest_user_id(user_id(3), 2, &migrated_user_ids), user_id(3));
        migration.record_scanned_up_to(None);

        assert!(migration.is_scan_complete());
        assert!(!migration.is_complete());
        assert_eq!(migration.user_ids_to_look_up(10), vec![user_id(2), user_id(3)]);

        // User 2 has been migrated, user 3 hasn't
        migration.record_lookup(
            &[user_id(2), user_id(3)],
            &HashMap::from([(user_id(2), user_id(12))]),
            &mut migrated_user_ids,
        );

        assert_eq!(migrated_user_ids.get(&user_id(2)), Some(user_id(12)));
        assert!(migration.user_ids_to_look_up(10).is_empty());
        assert_eq!(migration.metrics().events_to_update, 3);
        assert!(!migration.is_complete());

        let mut to_update = migration.take_events_to_update(2);
        assert!(!migration.is_complete());
        to_update.extend(migration.take_events_to_update(2));
        to_update.sort();
        assert_eq!(to_update, vec![0, 1, 2]);
        assert!(migration.take_events_to_update(2).is_empty());
        assert!(migration.is_complete());
        migration.record_events_updated(3);
        let metrics = migration.metrics();
        assert_eq!(metrics.events_updated, 4);
        assert_eq!(metrics.user_ids_to_look_up, 0);
        // The ids found not to have been migrated are dropped once complete
        assert_eq!(metrics.user_ids_not_migrated, 0);
    }

    #[test]
    fn ids_found_not_to_have_been_migrated_are_only_looked_up_once() {
        let mut migrated_user_ids = MigratedUserIds::default();
        let mut migration = UserIdsInEventsMigration::<u32>::default();

        migration.latest_user_id(user_id(2), 0, &migrated_user_ids);
        migration.record_scanned_up_to(Some(0));
        migration.record_lookup(&[user_id(2)], &HashMap::new(), &mut migrated_user_ids);
        assert!(migration.take_events_to_update(10).is_empty());

        migration.latest_user_id(user_id(2), 1, &migrated_user_ids);
        assert!(migration.user_ids_to_look_up(10).is_empty());
        assert_eq!(migration.scanned_up_to(), Some(0));
        assert!(!migration.is_complete());
    }

    #[test]
    fn restarting_the_scan_scans_from_the_start() {
        let mut migration = UserIdsInEventsMigration::<u32>::default();
        migration.record_scanned_up_to(None);
        assert!(migration.is_complete());

        migration.restart_scan();

        assert!(!migration.is_complete());
        assert_eq!(migration.scanned_up_to(), None);
    }

    #[test]
    fn the_scan_has_started_once_any_events_have_been_scanned() {
        let mut migration = UserIdsInEventsMigration::<u32>::default();
        assert!(!migration.has_started());

        migration.record_scanned_up_to(Some(1));
        assert!(migration.has_started());

        // Including when there turned out to be none
        let mut migration = UserIdsInEventsMigration::<u32>::default();
        migration.record_scanned_up_to(None);
        assert!(migration.has_started());
        migration.restart_scan();
        assert!(!migration.has_started());
    }
}
