use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use types::{BuildVersion, CanisterId, TimestampMillis, UserId};
use user_index_canister::user_migration::UserMigrationStatus;

const DEFAULT_CONCURRENCY: u32 = 5;

// The users being migrated from canisters of their own to MultiUser canisters. Users are queued,
// then taken from the queue while fewer than `concurrency` are being migrated, each being assigned a
// MultiUser canister and sent to the LocalUserIndex controlling their canister, which reports back
// whether the migration started.
#[derive(Serialize, Deserialize)]
pub struct UserMigrations {
    concurrency: u32,
    queue: VecDeque<QueuedUser>,
    // The users in `queue`, to check for users already queued without scanning the queue
    queued: HashSet<UserId>,
    in_progress: HashMap<UserId, UserMigration>,
    // Users who failed to be migrated aren't queued again
    failed: HashMap<UserId, FailedUserMigration>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct QueuedUser {
    pub user_id: UserId,
    // Overrides the MultiUser canister the user is migrated to, which is only allowed in test mode
    pub multi_user_canister_id: Option<CanisterId>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct UserMigration {
    pub multi_user_canister_id: CanisterId,
    pub requested: TimestampMillis,
    // Set once the user's canister has started migrating them, from when it is frozen until the
    // MultiUser canister has pulled them
    pub started: Option<StartedUserMigration>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct StartedUserMigration {
    pub timestamp: TimestampMillis,
    pub user_bytes: u64,
    pub wasm_version: BuildVersion,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FailedUserMigration {
    pub multi_user_canister_id: CanisterId,
    pub timestamp: TimestampMillis,
    pub error: OCError,
}

impl Default for UserMigrations {
    fn default() -> Self {
        UserMigrations {
            concurrency: DEFAULT_CONCURRENCY,
            queue: VecDeque::new(),
            queued: HashSet::new(),
            in_progress: HashMap::new(),
            failed: HashMap::new(),
        }
    }
}

impl UserMigrations {
    pub fn set_concurrency(&mut self, value: u32) {
        self.concurrency = value;
    }

    // Whether the user is queued, being migrated or has failed to be migrated
    pub fn contains(&self, user_id: &UserId) -> bool {
        self.queued.contains(user_id) || self.in_progress.contains_key(user_id) || self.failed.contains_key(user_id)
    }

    // Returns false if the user is already queued or being migrated, or has failed to be migrated
    // and `retry_failed` is false
    pub fn enqueue(&mut self, user: QueuedUser, retry_failed: bool) -> bool {
        let user_id = user.user_id;
        if self.queued.contains(&user_id)
            || self.in_progress.contains_key(&user_id)
            || (!retry_failed && self.failed.contains_key(&user_id))
        {
            false
        } else {
            self.failed.remove(&user_id);
            self.queue.push_back(user);
            self.queued.insert(user_id);
            true
        }
    }

    // Takes the next user from the queue, if fewer than `concurrency` users are being migrated. The
    // caller must then either mark them as requested or return them to the queue
    pub fn try_take_next(&mut self) -> Option<QueuedUser> {
        if self.in_progress.len() >= self.concurrency as usize {
            return None;
        }
        let user = self.queue.pop_front()?;
        self.queued.remove(&user.user_id);
        Some(user)
    }

    pub fn return_to_front(&mut self, user: QueuedUser) {
        self.queued.insert(user.user_id);
        self.queue.push_front(user);
    }

    pub fn mark_requested(&mut self, user_id: UserId, multi_user_canister_id: CanisterId, now: TimestampMillis) {
        self.in_progress.insert(
            user_id,
            UserMigration {
                multi_user_canister_id,
                requested: now,
                started: None,
            },
        );
    }

    // Returns false if the user isn't being migrated to the given MultiUser canister
    pub fn mark_started(
        &mut self,
        user_id: UserId,
        multi_user_canister_id: CanisterId,
        user_bytes: u64,
        wasm_version: BuildVersion,
        now: TimestampMillis,
    ) -> bool {
        match self.in_progress.get_mut(&user_id) {
            Some(migration) if migration.multi_user_canister_id == multi_user_canister_id => {
                migration.started.get_or_insert(StartedUserMigration {
                    timestamp: now,
                    user_bytes,
                    wasm_version,
                });
                true
            }
            _ => false,
        }
    }

    // Returns false if the user isn't being migrated to the given MultiUser canister
    pub fn mark_cancelled(&mut self, user_id: UserId, multi_user_canister_id: CanisterId) -> bool {
        if self
            .in_progress
            .get(&user_id)
            .is_some_and(|m| m.multi_user_canister_id == multi_user_canister_id)
        {
            self.in_progress.remove(&user_id);
            true
        } else {
            false
        }
    }

    // Returns false if the user isn't being migrated to the given MultiUser canister, or if their
    // migration has already started
    pub fn mark_failed(
        &mut self,
        user_id: UserId,
        multi_user_canister_id: CanisterId,
        error: OCError,
        now: TimestampMillis,
    ) -> bool {
        match self.in_progress.get(&user_id) {
            Some(migration) if migration.multi_user_canister_id == multi_user_canister_id && migration.started.is_none() => {
                self.in_progress.remove(&user_id);
                self.failed.insert(
                    user_id,
                    FailedUserMigration {
                        multi_user_canister_id,
                        timestamp: now,
                        error,
                    },
                );
                true
            }
            _ => false,
        }
    }

    pub fn status(&self, user_id: &UserId) -> Option<UserMigrationStatus> {
        if let Some(migration) = self.in_progress.get(user_id) {
            Some(match &migration.started {
                Some(started) => UserMigrationStatus::Started {
                    multi_user_canister_id: migration.multi_user_canister_id,
                    timestamp: started.timestamp,
                    user_bytes: started.user_bytes,
                    wasm_version: started.wasm_version,
                },
                None => UserMigrationStatus::Requested {
                    multi_user_canister_id: migration.multi_user_canister_id,
                    timestamp: migration.requested,
                },
            })
        } else if let Some(failed) = self.failed.get(user_id) {
            Some(UserMigrationStatus::Failed {
                multi_user_canister_id: failed.multi_user_canister_id,
                timestamp: failed.timestamp,
                error: failed.error.clone(),
            })
        } else {
            self.queued.contains(user_id).then_some(UserMigrationStatus::Queued)
        }
    }

    // The number of users being migrated to each MultiUser canister
    pub fn in_progress_per_canister(&self) -> HashMap<CanisterId, u32> {
        let mut counts = HashMap::new();
        for migration in self.in_progress.values() {
            *counts.entry(migration.multi_user_canister_id).or_default() += 1;
        }
        counts
    }

    pub fn metrics(&self) -> UserMigrationsMetrics {
        let mut failed_by_error_code = BTreeMap::new();
        for failed in self.failed.values() {
            *failed_by_error_code.entry(failed.error.code()).or_default() += 1;
        }

        UserMigrationsMetrics {
            concurrency: self.concurrency,
            queued: self.queue.len(),
            requested: self.in_progress.values().filter(|m| m.started.is_none()).count(),
            started: self.in_progress.values().filter(|m| m.started.is_some()).count(),
            failed: self.failed.len(),
            failed_by_error_code,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct UserMigrationsMetrics {
    pub concurrency: u32,
    pub queued: usize,
    pub requested: usize,
    pub started: usize,
    pub failed: usize,
    pub failed_by_error_code: BTreeMap<u16, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use oc_error_codes::OCErrorCode;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn queued(i: u8) -> QueuedUser {
        QueuedUser {
            user_id: user_id(i),
            multi_user_canister_id: None,
        }
    }

    fn canister_id(i: u8) -> CanisterId {
        Principal::from_slice(&[10, i])
    }

    #[test]
    fn users_are_only_queued_once() {
        let mut migrations = UserMigrations::default();

        assert!(migrations.enqueue(queued(1), true));
        assert!(!migrations.enqueue(queued(1), true));

        let next = migrations.try_take_next().unwrap().user_id;
        migrations.mark_requested(next, canister_id(1), 1);
        assert!(!migrations.enqueue(queued(1), true));

        // A user who failed to be migrated is only queued again if asked
        migrations.mark_failed(next, canister_id(1), OCErrorCode::NotReadyForMigration.into(), 2);
        assert!(!migrations.enqueue(queued(1), false));
        assert!(migrations.enqueue(queued(1), true));
        assert_eq!(migrations.metrics().failed, 0);
    }

    #[test]
    fn cancelled_migration_frees_its_slot() {
        let mut migrations = UserMigrations::default();
        migrations.set_concurrency(1);
        migrations.enqueue(queued(1), false);
        migrations.enqueue(queued(2), false);
        let next = migrations.try_take_next().unwrap().user_id;
        migrations.mark_requested(next, canister_id(1), 1);
        migrations.mark_started(next, canister_id(1), 100, BuildVersion::default(), 2);

        assert!(!migrations.mark_cancelled(user_id(1), canister_id(2)));
        assert!(migrations.try_take_next().is_none());

        assert!(migrations.mark_cancelled(user_id(1), canister_id(1)));
        assert_eq!(migrations.try_take_next(), Some(queued(2)));
        assert!(migrations.enqueue(queued(1), false));
    }

    #[test]
    fn no_more_than_concurrency_users_are_migrated_at_once() {
        let mut migrations = UserMigrations::default();
        migrations.set_concurrency(2);
        for i in 1..=3 {
            migrations.enqueue(queued(i), false);
        }

        for i in 1..=2 {
            let next = migrations.try_take_next().unwrap().user_id;
            assert_eq!(next, user_id(i));
            migrations.mark_requested(next, canister_id(1), 1);
        }
        assert!(migrations.try_take_next().is_none());

        // Started migrations still take up a slot
        assert!(migrations.mark_started(user_id(1), canister_id(1), 100, BuildVersion::default(), 2));
        assert!(migrations.try_take_next().is_none());

        // A failed migration frees up its slot
        assert!(migrations.mark_failed(user_id(2), canister_id(1), OCErrorCode::NotReadyForMigration.into(), 3));
        assert_eq!(migrations.try_take_next(), Some(queued(3)));
    }

    #[test]
    fn results_for_another_canister_are_ignored() {
        let mut migrations = UserMigrations::default();
        migrations.enqueue(queued(1), false);
        let next = migrations.try_take_next().unwrap().user_id;
        migrations.mark_requested(next, canister_id(1), 1);

        assert!(!migrations.mark_started(user_id(1), canister_id(2), 100, BuildVersion::default(), 2));
        assert!(!migrations.mark_failed(user_id(1), canister_id(2), OCErrorCode::NotReadyForMigration.into(), 2));

        let metrics = migrations.metrics();
        assert_eq!(metrics.requested, 1);
        assert_eq!(metrics.started, 0);
        assert_eq!(metrics.failed, 0);
    }

    #[test]
    fn started_migration_is_not_marked_failed() {
        let mut migrations = UserMigrations::default();
        migrations.enqueue(queued(1), false);
        let next = migrations.try_take_next().unwrap().user_id;
        migrations.mark_requested(next, canister_id(1), 1);
        migrations.mark_started(user_id(1), canister_id(1), 100, BuildVersion::default(), 2);

        assert!(!migrations.mark_failed(user_id(1), canister_id(1), OCErrorCode::NotReadyForMigration.into(), 3));
        assert_eq!(migrations.metrics().started, 1);
    }

    #[test]
    fn metrics_group_failures_by_error_code() {
        let mut migrations = UserMigrations::default();
        for i in 1..=3 {
            migrations.enqueue(queued(i), false);
            let next = migrations.try_take_next().unwrap().user_id;
            migrations.mark_requested(next, canister_id(1), 1);
        }
        migrations.mark_failed(user_id(1), canister_id(1), OCErrorCode::NotReadyForMigration.into(), 2);
        migrations.mark_failed(user_id(2), canister_id(1), OCErrorCode::NotReadyForMigration.into(), 2);
        migrations.mark_failed(user_id(3), canister_id(1), OCErrorCode::TargetUserNotFound.into(), 2);

        let metrics = migrations.metrics();
        assert_eq!(metrics.failed, 3);
        assert_eq!(
            metrics.failed_by_error_code,
            BTreeMap::from([
                (OCErrorCode::TargetUserNotFound as u16, 1),
                (OCErrorCode::NotReadyForMigration as u16, 2)
            ])
        );
    }

    #[test]
    fn status_follows_the_migration() {
        let mut migrations = UserMigrations::default();
        assert_eq!(migrations.status(&user_id(1)), None);

        migrations.enqueue(queued(1), false);
        assert_eq!(migrations.status(&user_id(1)), Some(UserMigrationStatus::Queued));

        let next = migrations.try_take_next().unwrap().user_id;
        migrations.mark_requested(next, canister_id(1), 1);
        assert_eq!(
            migrations.status(&user_id(1)),
            Some(UserMigrationStatus::Requested {
                multi_user_canister_id: canister_id(1),
                timestamp: 1
            })
        );

        migrations.mark_started(next, canister_id(1), 100, BuildVersion::new(1, 2, 3), 2);
        assert_eq!(
            migrations.status(&user_id(1)),
            Some(UserMigrationStatus::Started {
                multi_user_canister_id: canister_id(1),
                timestamp: 2,
                user_bytes: 100,
                wasm_version: BuildVersion::new(1, 2, 3),
            })
        );

        migrations.enqueue(queued(2), false);
        let next = migrations.try_take_next().unwrap().user_id;
        migrations.mark_requested(next, canister_id(1), 3);
        migrations.mark_failed(next, canister_id(1), OCErrorCode::NotReadyForMigration.into(), 4);
        assert_eq!(
            migrations.status(&user_id(2)),
            Some(UserMigrationStatus::Failed {
                multi_user_canister_id: canister_id(1),
                timestamp: 4,
                error: OCErrorCode::NotReadyForMigration.into(),
            })
        );
    }
}
