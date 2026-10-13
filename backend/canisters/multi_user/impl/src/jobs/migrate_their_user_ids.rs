use crate::model::users::Users;
use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use ic_cdk_timers::TimerId;
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tracing::{error, info, trace};
use types::{TimestampMillis, UserId};
use utils::migrated_user_ids::MigratedUserIds;

// Gathering the ids to look up stops once past the first limit, and moving users off old ids once
// the message has used the second, which, when there is nothing to look up, includes the gathering
const MAX_INSTRUCTIONS_TO_GATHER: u64 = 1_000_000_000;
const MAX_INSTRUCTIONS_PER_MESSAGE: u64 = 3_000_000_000;
const MAX_USER_IDS_PER_LOOKUP: usize = 5_000;
const LOOKUP_RETRY_DELAY: Duration = Duration::from_secs(60);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// The progress of the job, which is also shown in the canister's metrics
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct TheirUserIdsMigration {
    // The index from which the next batch of users starts
    pub next_user_index: u16,
    pub complete: bool,
    // How many times a user was found to hold anything under another user's old id
    pub old_user_ids_found: u32,
    // How many of those chats were left under the old id, since the user already had a chat under
    // the other user's latest id (see `DirectChats::migrate_their_user_id`)
    pub chats_left_under_old_ids: u32,
    // How many ids have been looked up in the LocalUserIndex, an id held by users in more than one
    // batch being looked up once for each
    pub user_ids_looked_up: u32,
}

// Moves what each user holds under other users' old ids, ie. their direct chats, blocks and
// contacts, onto those users' latest ids (see `User::migrate_their_user_id`), which otherwise only
// happens once the other user makes contact. Goes through the users in order of index, a batch at a
// time: the ids the batch's users hold which `MigratedUserIds` doesn't know are looked up in the
// LocalUserIndex, any migrations found are added to `MigratedUserIds`, and then each of the batch's
// users is moved off any id it has a migration for. This can be removed once it has completed in
// every MultiUser canister.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.their_user_ids_migration.complete {
        start_timer(Duration::ZERO);
        true
    } else {
        false
    }
}

// `TIMER_ID` stays set until the run has finished, including while it waits on a lookup, so that
// only one run is ever in progress
fn start_timer(delay: Duration) {
    TIMER_ID.set(Some(ic_cdk_timers::set_timer(delay, run())));
}

async fn run() {
    trace!("'migrate_their_user_ids' job running");
    run_regular_jobs();

    let (batch, local_user_index_canister_id) = read_state(|state| {
        let from = state.data.their_user_ids_migration.next_user_index;
        let batch = user_ids_to_look_up(&state.data.users, &state.data.migrated_user_ids, from, &mut || {
            ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_TO_GATHER
        })
        .map(|(user_ids, to)| (from, to, user_ids));
        (batch, state.data.local_user_index_canister_id)
    });

    let Some((from, to, user_ids)) = batch else {
        mutate_state(|state| {
            let migration = &mut state.data.their_user_ids_migration;
            migration.complete = true;
            info!(
                ?migration,
                "Finished moving users' chats, blocks and contacts off old user ids"
            );
        });
        TIMER_ID.set(None);
        return;
    };

    if !user_ids.is_empty() {
        let args = local_user_index_canister::migrated_user_ids::Args { user_ids };
        match local_user_index_canister_c2c_client::migrated_user_ids(local_user_index_canister_id, &args).await {
            Ok(local_user_index_canister::migrated_user_ids::Response::Success(migrated)) => mutate_state(|state| {
                let data = &mut state.data;
                record_lookup(
                    args.user_ids.len(),
                    &migrated,
                    &mut data.migrated_user_ids,
                    &mut data.their_user_ids_migration,
                );
                info!(
                    looked_up = args.user_ids.len(),
                    migrated = migrated.len(),
                    "Looked up user ids held by users in the LocalUserIndex"
                );
            }),
            Err(error) => {
                error!(?error, "Failed to look up migrated user ids");
                start_timer(LOOKUP_RETRY_DELAY);
                return;
            }
        }
    }

    mutate_state(|state| {
        let now = state.env.now();
        let data = &mut state.data;
        migrate(
            &mut data.users,
            &data.migrated_user_ids,
            from,
            to,
            &mut data.their_user_ids_migration,
            now,
            &mut || ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_MESSAGE,
        );
    });

    TIMER_ID.set(None);
    read_state(start_job_if_required);
}

// The ids held by the users from index `from` onwards which may have been migrated and which
// `migrated_user_ids` doesn't know, gathered from as many users as fit in one lookup, or until
// `should_stop` returns true, along with the index after the last of those users. None if there are
// no users from `from` onwards. Only an unindexed id, which was a User canister's, can be one a
// user has been migrated from, so MultiUser users' ids are never looked up.
fn user_ids_to_look_up(
    users: &Users,
    migrated_user_ids: &MigratedUserIds,
    from: u16,
    should_stop: &mut dyn FnMut() -> bool,
) -> Option<(Vec<UserId>, u16)> {
    let mut user_ids = HashSet::new();
    let mut to = None;
    while let Some(user_index) = users.next_index(to.unwrap_or(from)) {
        users.with_user(user_index, |user| {
            user_ids.extend(
                user.their_user_ids()
                    .into_iter()
                    .filter(|user_id| !user_id.is_indexed() && !migrated_user_ids.contains(user_id)),
            )
        });
        // Indexes go no higher than `MAX_USER_INDEX`, so this can't overflow
        to = Some(user_index + 1);
        if user_ids.len() >= MAX_USER_IDS_PER_LOOKUP || should_stop() {
            break;
        }
    }
    to.map(|to| (user_ids.into_iter().collect(), to))
}

fn record_lookup(
    looked_up: usize,
    migrated: &HashMap<UserId, UserId>,
    migrated_user_ids: &mut MigratedUserIds,
    migration: &mut TheirUserIdsMigration,
) {
    for (&user_id, &latest) in migrated {
        if !migrated_user_ids.insert(user_id, latest) && migrated_user_ids.get(&user_id).is_none() {
            // Should never happen, since it means another id has already been migrated to `latest`
            error!(?user_id, ?latest, "Failed to record user id migration");
        }
    }
    migration.user_ids_looked_up += looked_up as u32;
}

// Moves each of the users from index `from` up to `to` off every id they hold which
// `migrated_user_ids` has a migration for, then records that the next batch starts at `to`. Users
// added since the batch's ids were gathered have indexes of `to` or above, so are left to the next.
// If `should_stop` returns true first, the next batch starts after the last user moved instead, and
// the ids looked up for the rest are known by then.
fn migrate(
    users: &mut Users,
    migrated_user_ids: &MigratedUserIds,
    from: u16,
    to: u16,
    migration: &mut TheirUserIdsMigration,
    now: TimestampMillis,
    should_stop: &mut dyn FnMut() -> bool,
) {
    let mut next = from;
    while let Some(user_index) = users.next_index(next).filter(|i| *i < to) {
        users.with_user_mut(user_index, |user| {
            for old_user_id in user.their_user_ids() {
                if let Some(latest) = migrated_user_ids.get(&old_user_id) {
                    user.migrate_their_user_id(old_user_id, latest, now);
                    migration.old_user_ids_found += 1;
                    if user.direct_chats.exists(&old_user_id.into()) {
                        migration.chats_left_under_old_ids += 1;
                    }
                }
            }
        });
        next = user_index + 1;
        if should_stop() {
            migration.next_user_index = next;
            return;
        }
    }
    migration.next_user_index = to;
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use multi_user_canister::set_contact::OptionalContact;
    use types::{CanisterId, Chat, OptionUpdate, UserType};

    fn canister_id(i: u8) -> CanisterId {
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, i, 1, 1])
    }

    // A user in a MultiUser canister
    fn user_id(i: u8) -> UserId {
        UserId::new_indexed(canister_id(1), i as u16)
    }

    // The User canister ids migrated users had, and the ids they were migrated to
    fn old_user_id(i: u8) -> UserId {
        canister_id(100 + i).into()
    }

    fn new_user_id(i: u8) -> UserId {
        UserId::new_indexed(canister_id(2), i as u16)
    }

    // A bot, whose id is unindexed but was never migrated
    fn bot_id() -> UserId {
        canister_id(50).into()
    }

    // Three users: user 1 has a chat with migrated user 1, as a favourite, and has blocked migrated
    // user 2; user 2 has a contact for migrated user 1, a chat with user 10, who is in a MultiUser
    // canister, and a chat with a bot; user 3 has a chat with migrated user 2 under both their ids
    fn setup() -> Users {
        init_stable_memory_map();
        let mut users = Users::default();
        for i in 1..=3 {
            users.add(Principal::from_slice(&[i]), format!("user{i}"), None, 0).unwrap();
        }
        users.with_user_mut(1, |user| {
            user.direct_chats
                .get_or_create(user_id(1), old_user_id(1), UserType::User, || 1, 0);
            user.favourite_chats.add(Chat::Direct(old_user_id(1).into()), 0).unwrap();
            user.blocked_users.block(old_user_id(2), 0);
        });
        users.with_user_mut(2, |user| {
            set_contact(user, old_user_id(1), "one");
            user.direct_chats
                .get_or_create(user_id(2), user_id(10), UserType::User, || 1, 0);
            user.direct_chats
                .get_or_create(user_id(2), bot_id(), UserType::BotV2, || 2, 0);
        });
        users.with_user_mut(3, |user| {
            user.direct_chats
                .get_or_create(user_id(3), old_user_id(2), UserType::User, || 1, 0);
            user.direct_chats
                .get_or_create(user_id(3), new_user_id(2), UserType::User, || 2, 0);
        });
        users
    }

    fn init_stable_memory_map() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_multi_user(memory_manager.get(MemoryId::new(0)), memory_manager.get(MemoryId::new(1)));
    }

    fn set_contact(user: &mut user_core::User, user_id: UserId, nickname: &str) {
        user.contacts.set_contact(OptionalContact {
            user_id,
            nickname: OptionUpdate::SetToSome(nickname.to_string()),
        });
    }

    fn contacts(users: &Users, user_index: u16) -> Vec<(UserId, Option<String>)> {
        users
            .with_user(user_index, |user| {
                user.contacts
                    .all()
                    .into_iter()
                    .map(|(user_id, contact)| (user_id, contact.nickname))
                    .collect()
            })
            .unwrap()
    }

    // Runs the job a batch at a time until it is complete, each batch's lookup finding the
    // migrations in `lookup`, and returns the ids each batch looked up
    fn run_to_completion(
        users: &mut Users,
        migrated_user_ids: &mut MigratedUserIds,
        should_stop: &mut dyn FnMut() -> bool,
    ) -> (TheirUserIdsMigration, Vec<HashSet<UserId>>) {
        let mut migration = TheirUserIdsMigration::default();
        let mut looked_up = Vec::new();
        while let Some((user_ids, to)) = user_ids_to_look_up(users, migrated_user_ids, migration.next_user_index, should_stop) {
            let migrated = lookup().get_many(user_ids.iter().copied());
            record_lookup(user_ids.len(), &migrated, migrated_user_ids, &mut migration);
            looked_up.push(user_ids.into_iter().collect());
            migrate(
                users,
                migrated_user_ids,
                migration.next_user_index,
                to,
                &mut migration,
                100,
                should_stop,
            );
        }
        (migration, looked_up)
    }

    // The migrations the LocalUserIndex knows of
    fn lookup() -> MigratedUserIds {
        let mut lookup = MigratedUserIds::default();
        lookup.insert(old_user_id(1), new_user_id(1));
        lookup.insert(old_user_id(2), new_user_id(2));
        lookup
    }

    #[test]
    fn every_users_chats_blocks_and_contacts_are_moved_onto_latest_ids() {
        let mut users = setup();
        let mut migrated_user_ids = MigratedUserIds::default();

        let (migration, looked_up) = run_to_completion(&mut users, &mut migrated_user_ids, &mut || false);

        // One batch held every user, so each unindexed id was looked up once
        assert_eq!(looked_up, vec![HashSet::from([old_user_id(1), old_user_id(2), bot_id()])]);
        assert_eq!(migrated_user_ids.get(&old_user_id(1)), Some(new_user_id(1)));
        users.with_user(1, |user| {
            assert!(user.direct_chats.get(&new_user_id(1).into()).is_some());
            assert!(user.direct_chats.get(&old_user_id(1).into()).is_none());
            assert_eq!(user.favourite_chats.chats(), &[Chat::Direct(new_user_id(1).into())]);
            assert_eq!(user.blocked_users.all(), vec![new_user_id(2)]);
        });
        assert_eq!(contacts(&users, 2), vec![(new_user_id(1), Some("one".to_string()))]);
        users.with_user(2, |user| {
            assert!(user.direct_chats.get(&user_id(10).into()).is_some());
            assert!(user.direct_chats.get(&bot_id().into()).is_some());
        });
        // The chat under the old id is left, since there is already one under the new id
        users.with_user(3, |user| {
            assert!(user.direct_chats.get(&old_user_id(2).into()).is_some());
            assert!(user.direct_chats.get(&new_user_id(2).into()).is_some());
        });
        assert_eq!(migration.old_user_ids_found, 4);
        assert_eq!(migration.chats_left_under_old_ids, 1);
        assert_eq!(migration.user_ids_looked_up, 3);
    }

    #[test]
    fn everything_held_under_the_same_old_id_is_moved_together() {
        let mut users = setup();
        users.with_user_mut(1, |user| {
            set_contact(user, old_user_id(1), "one");
            user.blocked_users.block(old_user_id(1), 0);
        });
        let mut migrated_user_ids = MigratedUserIds::default();

        let (migration, _) = run_to_completion(&mut users, &mut migrated_user_ids, &mut || false);

        users.with_user(1, |user| {
            assert!(user.direct_chats.get(&new_user_id(1).into()).is_some());
            assert_eq!(user.favourite_chats.chats(), &[Chat::Direct(new_user_id(1).into())]);
            assert_eq!(user.blocked_users.all(), vec![new_user_id(1), new_user_id(2)]);
        });
        assert_eq!(contacts(&users, 1), vec![(new_user_id(1), Some("one".to_string()))]);
        // User 1 holds two old ids, users 2 and 3 one each
        assert_eq!(migration.old_user_ids_found, 4);
    }

    #[test]
    fn blocks_and_contacts_under_both_ids_end_up_under_the_latest_id_alone() {
        let mut users = setup();
        users.with_user_mut(2, |user| {
            set_contact(user, new_user_id(1), "latest");
            user.blocked_users.block(old_user_id(1), 0);
            user.blocked_users.block(new_user_id(1), 0);
        });
        let mut migrated_user_ids = MigratedUserIds::default();

        run_to_completion(&mut users, &mut migrated_user_ids, &mut || false);

        assert_eq!(contacts(&users, 2), vec![(new_user_id(1), Some("latest".to_string()))]);
        users.with_user(2, |user| {
            assert_eq!(user.blocked_users.all(), vec![new_user_id(1)]);
            assert_eq!(user.blocked_users.len(), 1);
        });
    }

    #[test]
    fn ids_with_a_known_migration_are_moved_without_being_looked_up() {
        let mut users = setup();
        let mut migrated_user_ids = lookup();

        let (_, looked_up) = run_to_completion(&mut users, &mut migrated_user_ids, &mut || false);

        assert_eq!(looked_up, vec![HashSet::from([bot_id()])]);
        users.with_user(1, |user| assert!(user.direct_chats.get(&new_user_id(1).into()).is_some()));
    }

    #[test]
    fn users_are_migrated_a_batch_at_a_time() {
        let mut users = setup();
        let mut migrated_user_ids = MigratedUserIds::default();

        // Each batch stops after its first user
        let (migration, looked_up) = run_to_completion(&mut users, &mut migrated_user_ids, &mut || true);

        // An id found in an earlier batch is known by the time a later batch reaches it
        assert_eq!(
            looked_up,
            vec![
                HashSet::from([old_user_id(1), old_user_id(2)]),
                HashSet::from([bot_id()]),
                HashSet::new(),
            ]
        );
        assert_eq!(contacts(&users, 2), vec![(new_user_id(1), Some("one".to_string()))]);
        assert_eq!(migration.old_user_ids_found, 4);
        assert_eq!(migration.chats_left_under_old_ids, 1);
    }

    #[test]
    fn moving_users_can_stop_part_way_through_a_batch() {
        let mut users = setup();
        let mut migrated_user_ids = MigratedUserIds::default();
        let mut migration = TheirUserIdsMigration::default();

        let (user_ids, to) = user_ids_to_look_up(&users, &migrated_user_ids, 0, &mut || false).unwrap();
        record_lookup(
            user_ids.len(),
            &lookup().get_many(user_ids),
            &mut migrated_user_ids,
            &mut migration,
        );
        migrate(&mut users, &migrated_user_ids, 0, to, &mut migration, 100, &mut || true);

        // Only user 1 was moved, and the next batch starts after them, with nothing left to look up
        assert_eq!(migration.next_user_index, 2);
        assert_eq!(contacts(&users, 2), vec![(old_user_id(1), Some("one".to_string()))]);
        let (user_ids, to) = user_ids_to_look_up(&users, &migrated_user_ids, 2, &mut || false).unwrap();
        assert_eq!(user_ids, vec![bot_id()]);

        migrate(&mut users, &migrated_user_ids, 2, to, &mut migration, 100, &mut || false);

        assert_eq!(contacts(&users, 2), vec![(new_user_id(1), Some("one".to_string()))]);
        assert_eq!(migration.next_user_index, 4);
    }

    #[test]
    fn users_added_while_a_batch_is_being_looked_up_are_left_to_the_next_batch() {
        let mut users = setup();
        let mut migrated_user_ids = MigratedUserIds::default();
        let mut migration = TheirUserIdsMigration::default();

        let (_, to) = user_ids_to_look_up(&users, &migrated_user_ids, 0, &mut || false).unwrap();
        let index = users.add(Principal::from_slice(&[4]), "user4".to_string(), None, 0).unwrap();
        users.with_user_mut(index, |user| user.blocked_users.block(old_user_id(1), 0));
        migrated_user_ids.insert(old_user_id(1), new_user_id(1));
        migrate(&mut users, &migrated_user_ids, 0, to, &mut migration, 100, &mut || false);

        users.with_user(index, |user| assert_eq!(user.blocked_users.all(), vec![old_user_id(1)]));
        assert_eq!(migration.next_user_index, index);

        let (user_ids, to) = user_ids_to_look_up(&users, &migrated_user_ids, index, &mut || false).unwrap();
        assert!(user_ids.is_empty());
        migrate(&mut users, &migrated_user_ids, index, to, &mut migration, 100, &mut || false);

        users.with_user(index, |user| assert_eq!(user.blocked_users.all(), vec![new_user_id(1)]));
        assert!(user_ids_to_look_up(&users, &migrated_user_ids, migration.next_user_index, &mut || false).is_none());
    }

    #[test]
    fn there_is_no_batch_once_there_are_no_users_left() {
        let users = setup();
        let migrated_user_ids = MigratedUserIds::default();

        assert!(user_ids_to_look_up(&users, &migrated_user_ids, 0, &mut || false).is_some());
        assert!(user_ids_to_look_up(&users, &migrated_user_ids, 3, &mut || false).is_some());
        assert!(user_ids_to_look_up(&users, &migrated_user_ids, 4, &mut || false).is_none());
    }
}
