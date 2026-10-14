use crate::jobs::update_user_ids_in_events;
use crate::{Data, RuntimeState, mutate_state, read_state, run_regular_jobs};
use group_community_common::UserIdsInStateMigration;
use ic_cdk_timers::TimerId;
use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, TimestampMillis, UserId};
use utils::mentions::replace_mentioned_users;

const MAX_INSTRUCTIONS_PER_BATCH: u64 = 2_000_000_000;
const MAX_USER_IDS_PER_LOOKUP: usize = 5_000;
const LOOKUP_RETRY_DELAY: Duration = Duration::from_secs(60);
// How many entries in stable memory are read at a time, the instructions used being checked after
// each batch
const STABLE_MEMORY_BATCH_SIZE: usize = 100;

// Where a pass through the group's state has got to (see `step`)
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum StatePosition {
    // The users' metrics in stable memory, after the given user
    #[serde(rename = "m")]
    Metrics(Option<UserId>),
    // Moving the records held under the ids users had before being migrated onto their latest ids
    #[serde(rename = "v")]
    Move,
    // The map of principals to user ids, after the given principal
    #[serde(rename = "p")]
    Principals(Option<Principal>),
}

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Replaces the ids users had before being migrated to MultiUser canisters with their latest ids
// throughout the group's state other than its events (see `UserIdsInStateMigration`). Each run
// either looks up a batch of the ids found in the LocalUserIndex, or passes through as much of the
// state as it can. Once complete, the job which does the same for the group's events is started,
// from the start if it had already begun, so that it also catches any old ids written into events
// in the meantime. This can be removed once it has completed in every group.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && !state.data.user_ids_in_state_migration.is_complete()
        // A group being imported into a community has exported its state, and its members are read
        // from stable memory as the import goes, so they are left as they are
        && !state.data.is_being_imported_into_community()
    {
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
    trace!("'update_user_ids_in_state' job running");
    run_regular_jobs();

    if let Some((user_ids, local_user_index_canister_id)) = mutate_state(run_batch) {
        let args = local_user_index_canister::migrated_user_ids::Args {
            user_ids: user_ids.clone(),
        };
        match local_user_index_canister_c2c_client::migrated_user_ids(local_user_index_canister_id, &args).await {
            Ok(local_user_index_canister::migrated_user_ids::Response::Success(migrated)) => {
                mutate_state(|state| record_lookup(&user_ids, migrated, state))
            }
            Err(error) => {
                error!(?error, "Failed to look up migrated user ids");
                start_timer(LOOKUP_RETRY_DELAY);
                return;
            }
        }
    }

    mutate_state(|state| state.report_user_id_migration_progress());
    TIMER_ID.set(None);
    read_state(start_job_if_required);
}

// Returns the next ids to look up if there are any, otherwise passes through a batch of the state
fn run_batch(state: &mut RuntimeState) -> Option<(Vec<UserId>, CanisterId)> {
    if state.data.is_being_imported_into_community() {
        return None;
    }
    let user_ids = state
        .data
        .user_ids_in_state_migration
        .user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
    if !user_ids.is_empty() {
        return Some((user_ids, state.data.local_user_index_canister_id));
    }

    let now = state.env.now();
    update(&mut state.data, now, &mut || {
        ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH
    });

    if state.data.user_ids_in_state_migration.is_complete() {
        info!(
            metrics = ?state.data.user_ids_in_state_migration.metrics(),
            "Finished replacing migrated user ids in the group's state"
        );
        prepare_events_migration(&mut state.data);
        update_user_ids_in_events::start_job_if_required(state);
    }
    None
}

fn record_lookup(user_ids: &[UserId], migrated: HashMap<UserId, UserId>, state: &mut RuntimeState) {
    let data = &mut state.data;
    data.user_ids_in_state_migration
        .record_lookup(user_ids, &migrated, &mut data.migrated_user_ids);

    info!(
        looked_up = user_ids.len(),
        migrated = migrated.len(),
        "Looked up user ids found in the group's state in the LocalUserIndex"
    );
}

// The events may have been scanned while this job was running, during which old ids could still be
// written into new events, so if the scan had begun it starts again
fn prepare_events_migration(data: &mut Data) {
    let events_migration = &mut data.user_ids_in_events_migration;
    if events_migration.scanned_up_to().is_some() || events_migration.is_scan_complete() {
        events_migration.restart_scan();
    }
}

// Carries on passing through the state, a step at a time, until `should_stop` returns true or the
// pass has finished. The migration is taken out of `data` meanwhile, so that both can be updated.
fn update(data: &mut Data, now: TimestampMillis, should_stop: &mut dyn FnMut() -> bool) {
    let mut migration = std::mem::take(&mut data.user_ids_in_state_migration);
    while let Some(position) = migration.pass_position() {
        let next = step(data, &mut migration, position, now, should_stop);
        migration.record_position(next);
        if should_stop() {
            break;
        }
    }
    data.user_ids_in_state_migration = migration;
}

// Takes one step through the state from `position`, returning where the next carries on from, None
// once the pass has finished. A pass gathers the ids on the heap first, then those in stable memory,
// then moves the records held under old ids, then replaces the ids in the map of principals, which
// by then only points at old ids with nothing held under them (eg. those of invited users, whose
// invitations have been moved), unless their migrations were learned during the pass.
fn step(
    data: &mut Data,
    migration: &mut UserIdsInStateMigration<StatePosition>,
    position: Option<StatePosition>,
    now: TimestampMillis,
    should_stop: &mut dyn FnMut() -> bool,
) -> Option<StatePosition> {
    match position {
        None => {
            update_heap(data, migration, now);
            Some(StatePosition::Metrics(None))
        }
        Some(StatePosition::Metrics(mut after)) => loop {
            let user_ids = data
                .chat
                .events
                .user_ids_with_metrics_in_stable_memory(after, STABLE_MEMORY_BATCH_SIZE);
            for user_id in user_ids.iter() {
                migration.record_key(*user_id, &data.migrated_user_ids);
            }
            if user_ids.len() < STABLE_MEMORY_BATCH_SIZE {
                return Some(StatePosition::Move);
            }
            after = user_ids.last().copied();
            if should_stop() {
                return Some(StatePosition::Metrics(after));
            }
        },
        Some(StatePosition::Move) => {
            while let Some(old_user_id) = migration.take_next_to_move() {
                let latest = data.migrated_user_ids.latest(old_user_id);
                if data.migrate_user_id(old_user_id, latest, None, now) {
                    migration.record_moved();
                }
                if should_stop() {
                    return Some(StatePosition::Move);
                }
            }
            Some(StatePosition::Principals(None))
        }
        Some(StatePosition::Principals(mut after)) => loop {
            let migrated_user_ids = &data.migrated_user_ids;
            let chat = &data.chat;
            // None once there are no entries left, which finishes the pass
            let last = data
                .principal_to_user_id_map
                .update_user_ids(after, STABLE_MEMORY_BATCH_SIZE, &mut |user_id| {
                    // A principal is left pointing at an id under which a membership, block or
                    // invitation is still held, so that it never points at an id the user has no
                    // records under (see `UserIdsInStateMigration::defer`)
                    if chat.members.contains(&user_id)
                        || chat.members.is_blocked(&user_id)
                        || chat.invited_users.contains(&user_id)
                    {
                        migration.defer(user_id, migrated_user_ids);
                        user_id
                    } else {
                        migration.latest_user_id(user_id, migrated_user_ids)
                    }
                })?;
            after = Some(last);
            if should_stop() {
                return Some(StatePosition::Principals(after));
            }
        },
    }
}

// Queues the records on the heap which are held under old ids to be moved (see
// `Data::migrate_user_id`), and replaces the old ids held as values
fn update_heap(data: &mut Data, migration: &mut UserIdsInStateMigration<StatePosition>, now: TimestampMillis) {
    let migrated_user_ids = &data.migrated_user_ids;
    for user_id in data
        .chat
        .user_ids_holding_records()
        .chain(data.expiring_members.user_ids())
        .chain(data.expiring_member_actions.user_ids())
        .chain(data.achievements.user_ids())
        .chain(data.user_cache.user_ids())
    {
        migration.record_key(user_id, migrated_user_ids);
    }

    let f = &mut |user_id| migration.latest_user_id(user_id, migrated_user_ids);
    data.chat.update_user_ids_outside_records(f, now);
    data.bots.update_added_by(f, now);
    if let Some(frozen) = data.frozen.value.as_mut() {
        frozen.frozen_by = f(frozen.frozen_by);
        if let Some(reason) = frozen
            .reason
            .as_deref()
            .and_then(|reason| replace_mentioned_users(reason, &mut *f))
        {
            frozen.reason = Some(reason);
        }
    }
    data.total_payment_receipts.update_user_ids(f);
}

#[cfg(test)]
mod tests {
    use super::*;
    use chat_events::{MessageContentInternal, NullEventPusher, PushMessageArgs, TextContentInternal};
    use group_chat_core::UserInvitation;
    use group_community_common::ExpiringMember;
    use stable_memory_map::StableMemoryMap;
    use types::{
        Achievement, BotPermissions, EventContext, EventIndex, FrozenGroupInfo, MessageId, MessageIndex, Timestamped, UserType,
    };
    use utils::migrated_user_ids::MigratedUserIds;

    const NOW: TimestampMillis = 1_000;

    fn canister_id(i: u8) -> CanisterId {
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, i, 1, 1])
    }

    // The User canister ids migrated users had, and the ids they were migrated to
    fn old_user_id(i: u8) -> UserId {
        canister_id(100 + i).into()
    }

    fn new_user_id(i: u8) -> UserId {
        UserId::new_indexed(canister_id(1), i as u16)
    }

    fn principal(i: u8) -> Principal {
        Principal::from_slice(&[i])
    }

    // A bot, whose id is unindexed but was never migrated
    fn bot_id() -> UserId {
        canister_id(50).into()
    }

    // The migrations the LocalUserIndex knows of
    fn lookup() -> MigratedUserIds {
        let mut lookup = MigratedUserIds::default();
        for i in 1..=7 {
            lookup.insert(old_user_id(i), new_user_id(i));
        }
        lookup
    }

    // Migrated user 1 created the group, mentions themselves in its description, and installed a
    // bot. Migrated user 2 is a member who has sent messages, joined under an expiring gate, been
    // given an achievement and paid to join. Migrated user 3 is blocked, user 4 was invited by
    // user 1, user 5 froze the group and user 6 is a former member who sent a message. Migrated user
    // 7 is a member under their latest id. The bot is a member.
    fn setup() -> Data {
        let mut data = Data::new_for_tests(old_user_id(1), principal(1), format!("Run by @UserId({})", old_user_id(1)));
        for (user_id, principal, user_type) in [
            (old_user_id(2), principal(2), UserType::User),
            (old_user_id(6), principal(6), UserType::User),
            (new_user_id(7), principal(7), UserType::User),
            (bot_id(), bot_id().as_principal(), UserType::BotV2),
        ] {
            data.chat.members.add(
                user_id,
                Some(principal),
                0,
                EventIndex::default(),
                MessageIndex::default(),
                false,
                user_type,
            );
            data.principal_to_user_id_map.insert(principal, user_id);
        }
        for (i, sender) in [old_user_id(2), old_user_id(6), old_user_id(2)].into_iter().enumerate() {
            send_message(&mut data, sender, i as u64);
        }
        data.chat.members.remove(old_user_id(6), 0);
        data.remove_user(old_user_id(6), Some(principal(6)));

        data.chat.members.block(old_user_id(3), 0);
        data.chat.invited_users.add(UserInvitation {
            invited: old_user_id(4),
            invited_by: old_user_id(1),
            timestamp: 0,
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
        });
        data.principal_to_user_id_map.insert(principal(4), old_user_id(4));
        data.expiring_members.push(ExpiringMember {
            expires: 2_000,
            channel_id: None,
            user_id: old_user_id(2),
        });
        data.achievements.award(old_user_id(2), Achievement::JoinedGroup);
        data.user_cache.insert(old_user_id(2), None, true, 0);
        data.total_payment_receipts.add(canister_id(20), 100, old_user_id(2));
        data.bots
            .add(bot_id(), old_user_id(1), BotPermissions::default(), None, None, 0);
        data.frozen = Timestamped::new(
            Some(FrozenGroupInfo {
                timestamp: 0,
                frozen_by: old_user_id(5),
                reason: Some(format!("Reported by @UserId({})", old_user_id(2))),
            }),
            0,
        );
        data
    }

    fn send_message(data: &mut Data, sender: UserId, message_id: u64) {
        data.chat.events.push_message::<NullEventPusher>(
            PushMessageArgs {
                sender,
                thread_root_message_index: None,
                message_id: MessageId::from(message_id),
                content: MessageContentInternal::Text(TextContentInternal { text: "hi".to_string() }),
                sender_context: None,
                mentioned: Vec::new(),
                replies_to: None,
                forwarded: false,
                sender_is_bot: false,
                block_level_markdown: false,
                og_previews: Vec::new(),
                now: 0,
            },
            None,
        );
    }

    // Runs the job until it is complete, each lookup finding the migrations in `lookup`, and returns
    // the ids looked up
    fn run_to_completion(data: &mut Data, should_stop: &mut dyn FnMut() -> bool) -> Vec<UserId> {
        let lookup = lookup();
        let mut looked_up = Vec::new();
        while !data.user_ids_in_state_migration.is_complete() {
            let user_ids = data.user_ids_in_state_migration.user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
            if user_ids.is_empty() {
                update(data, NOW, should_stop);
            } else {
                let migrated = lookup.get_many(user_ids.iter().copied());
                data.user_ids_in_state_migration
                    .record_lookup(&user_ids, &migrated, &mut data.migrated_user_ids);
                looked_up.extend(user_ids);
            }
        }
        looked_up
    }

    fn assert_every_old_id_replaced(data: &Data) {
        let members = &data.chat.members;
        for user_id in [new_user_id(1), new_user_id(2), new_user_id(7), bot_id()] {
            assert!(members.contains(&user_id));
        }
        assert!(members.member_ids().iter().all(|u| u.is_indexed() || *u == bot_id()));
        assert_eq!(members.get(&new_user_id(2)).unwrap().principal(), Some(principal(2)));
        assert_eq!(members.blocked(), vec![new_user_id(3)]);
        assert_eq!(members.owners().iter().copied().collect::<Vec<_>>(), vec![new_user_id(1)]);

        let invitation = data.chat.invited_users.get(&new_user_id(4)).unwrap();
        assert_eq!(invitation.invited_by, new_user_id(1));
        assert_eq!(data.chat.invited_users.len(), 1);

        for i in [1, 2, 4, 7] {
            assert_eq!(data.principal_to_user_id_map.get(&principal(i)), Some(new_user_id(i)));
        }
        assert_eq!(data.principal_to_user_id_map.get(&principal(6)), None);

        let events = &data.chat.events;
        assert_eq!(events.user_metrics(&new_user_id(2), None).unwrap().hydrate().text_messages, 2);
        assert_eq!(events.user_metrics(&new_user_id(6), None).unwrap().hydrate().text_messages, 1);
        assert!(events.user_metrics(&old_user_id(2), None).is_none());
        assert!(events.user_metrics(&old_user_id(6), None).is_none());

        assert_eq!(data.chat.created_by, new_user_id(1));
        assert_eq!(data.chat.description.value, format!("Run by @UserId({})", new_user_id(1)));
        assert_eq!(data.bots.get(&bot_id()).unwrap().added_by, new_user_id(1));
        assert_eq!(data.frozen.value.as_ref().unwrap().frozen_by, new_user_id(5));
        assert_eq!(
            data.frozen.value.as_ref().unwrap().reason,
            Some(format!("Reported by @UserId({})", new_user_id(2)))
        );
        assert_eq!(data.expiring_members.user_ids().collect::<Vec<_>>(), vec![new_user_id(2)]);
        assert_eq!(data.achievements.user_ids().collect::<Vec<_>>(), vec![new_user_id(2)]);
        assert_eq!(data.user_cache.user_ids().collect::<Vec<_>>(), vec![new_user_id(2)]);
        let mut receipts = data.total_payment_receipts.clone();
        assert!(!receipts.update_user_ids(&mut |user_id| {
            assert_ne!(user_id, old_user_id(2));
            user_id
        }));
    }

    #[test]
    fn every_old_id_in_the_state_is_replaced() {
        let mut data = setup();

        let mut looked_up = run_to_completion(&mut data, &mut || false);

        // Each unindexed id was looked up once, including the bot's, but not the latest ids
        looked_up.sort();
        let mut expected: Vec<_> = (1..=6).map(old_user_id).chain([bot_id()]).collect();
        expected.sort();
        assert_eq!(looked_up, expected);
        assert_every_old_id_replaced(&data);
        assert_eq!(data.chat.members.len(), 4);
        assert_eq!(data.principal_to_user_id_map.len(), 5);
        let metrics = data.user_ids_in_state_migration.metrics();
        assert_eq!(metrics.passes_completed, 2);
        assert_eq!(metrics.user_ids_looked_up, 7);
    }

    #[test]
    fn the_state_is_passed_through_a_batch_at_a_time() {
        let mut data = setup();
        // Enough members to fill several batches of the map of principals
        for i in 0..250u32 {
            let user_id = UserId::new_indexed(canister_id(2), i as u16);
            let principal = Principal::from_slice(&i.to_be_bytes());
            data.chat.members.add(
                user_id,
                Some(principal),
                0,
                EventIndex::default(),
                MessageIndex::default(),
                false,
                UserType::User,
            );
            data.principal_to_user_id_map.insert(principal, user_id);
        }

        // Each update takes a single step, reading a single batch from stable memory or moving a
        // single user's records
        let mut positions = Vec::new();
        while !data.user_ids_in_state_migration.is_complete() {
            run_single_step(&mut data);
            positions.push(data.user_ids_in_state_migration.pass_position());
        }

        assert!(positions.contains(&Some(Some(StatePosition::Move))));
        assert!(
            positions
                .iter()
                .filter(|p| matches!(p, Some(Some(StatePosition::Principals(Some(_))))))
                .count()
                >= 2
        );
        assert_every_old_id_replaced(&data);
        assert_eq!(data.principal_to_user_id_map.len(), 255);
    }

    // Takes a single step, or makes a single lookup
    fn run_single_step(data: &mut Data) {
        let user_ids = data.user_ids_in_state_migration.user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
        if user_ids.is_empty() {
            update(data, NOW, &mut || true);
        } else {
            let migrated = lookup().get_many(user_ids.iter().copied());
            data.user_ids_in_state_migration
                .record_lookup(&user_ids, &migrated, &mut data.migrated_user_ids);
        }
    }

    #[test]
    fn ids_with_known_migrations_are_replaced_without_being_looked_up() {
        let mut data = setup();
        data.migrated_user_ids = lookup();

        let looked_up = run_to_completion(&mut data, &mut || false);

        assert_eq!(looked_up, vec![bot_id()]);
        assert_every_old_id_replaced(&data);
    }

    #[test]
    fn a_member_blocked_under_their_latest_id_is_removed() {
        let mut data = setup();
        data.chat.members.block(new_user_id(2), 0);

        run_to_completion(&mut data, &mut || false);

        assert!(!data.chat.members.contains(&old_user_id(2)));
        assert!(!data.chat.members.contains(&new_user_id(2)));
        assert!(data.chat.members.is_blocked(&new_user_id(2)));
        assert_eq!(data.principal_to_user_id_map.get(&principal(2)), None);
    }

    #[test]
    fn the_events_job_waits_for_this_job_then_scans_again_if_it_had_begun() {
        let mut data = setup();
        assert!(!update_user_ids_in_events::is_required(&data));

        // The events job was released first and had begun scanning
        data.user_ids_in_events_migration
            .record_scanned_up_to(Some(EventContext::new(None, 10.into())));
        run_to_completion(&mut data, &mut || false);
        prepare_events_migration(&mut data);

        assert!(update_user_ids_in_events::is_required(&data));
        assert_eq!(data.user_ids_in_events_migration.scanned_up_to(), None);

        // Restarted, eg. once a group is imported into a community, it is held back again
        data.user_ids_in_state_migration.restart();
        assert!(!update_user_ids_in_events::is_required(&data));
    }

    #[test]
    fn the_events_job_scans_again_if_it_had_finished() {
        let mut data = setup();
        data.user_ids_in_events_migration.record_scanned_up_to(None);
        assert!(data.user_ids_in_events_migration.is_complete());

        run_to_completion(&mut data, &mut || false);
        prepare_events_migration(&mut data);

        assert!(!data.user_ids_in_events_migration.is_complete());
        assert!(update_user_ids_in_events::is_required(&data));
    }

    #[test]
    fn a_migration_learned_during_a_pass_is_only_applied_once_the_records_under_it_have_moved() {
        let mut data = setup();
        // The first lookup doesn't find user 2's migration, eg. because the LocalUserIndex hadn't yet
        // heard of it
        let mut lookup_without_user_2 = MigratedUserIds::default();
        for i in [1, 3, 4, 5, 6, 7] {
            lookup_without_user_2.insert(old_user_id(i), new_user_id(i));
        }
        while data.user_ids_in_state_migration.pass_position().is_some() {
            update(&mut data, NOW, &mut || true);
        }
        let user_ids = data.user_ids_in_state_migration.user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
        let migrated = lookup_without_user_2.get_many(user_ids.iter().copied());
        data.user_ids_in_state_migration
            .record_lookup(&user_ids, &migrated, &mut data.migrated_user_ids);

        // During the next pass, once the records have been moved, user 2's migration is learned, eg.
        // by events for them being sent on to their latest id
        while data.user_ids_in_state_migration.pass_position() != Some(Some(StatePosition::Principals(None))) {
            update(&mut data, NOW, &mut || true);
        }
        data.migrated_user_ids.insert(old_user_id(2), new_user_id(2));
        while matches!(data.user_ids_in_state_migration.pass_position(), Some(Some(_))) {
            update(&mut data, NOW, &mut || true);
        }

        // Their principal hasn't been pointed at their latest id, so still leads to their membership
        assert_eq!(data.get_member(principal(2)).map(|m| m.user_id()), Some(old_user_id(2)));

        // Another pass is made, with nothing to look up, which moves them
        assert_eq!(data.user_ids_in_state_migration.pass_position(), Some(None));
        let looked_up = run_to_completion(&mut data, &mut || false);
        assert!(looked_up.is_empty());
        assert_every_old_id_replaced(&data);
    }

    #[test]
    fn an_invitation_moved_before_the_principal_is_still_found() {
        let mut data = setup();
        data.migrated_user_ids = lookup();
        while data.user_ids_in_state_migration.pass_position() != Some(Some(StatePosition::Principals(None))) {
            update(&mut data, NOW, &mut || true);
        }
        assert_eq!(data.principal_to_user_id_map.get(&principal(4)), Some(old_user_id(4)));
        assert!(data.chat.invited_users.contains(&new_user_id(4)));

        assert!(data.get_invitation(principal(4)).is_some());
        assert!(data.remove_invitation(principal(4), NOW).is_some());
        assert!(data.chat.invited_users.is_empty());
    }
}
