use crate::model::users::Users;
use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use chat_events::UserIdsInEventsMigration;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::{BTreeMap, HashMap};
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, ChatId, EventContext, UserId};
use utils::migrated_user_ids::MigratedUserIds;

const MAX_INSTRUCTIONS_PER_BATCH: u64 = 2_000_000_000;
const MAX_USER_IDS_PER_LOOKUP: usize = 5_000;
const LOOKUP_RETRY_DELAY: Duration = Duration::from_secs(60);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Replaces the ids users had before being migrated to MultiUser canisters with their latest ids in
// the events of every user's direct chats (see `UserIdsInEventsMigration`), scanning the users in
// order of index and each user's chats in order of key_id. Each run does one of these, in order of
// priority: updates a batch of the events holding ids which have been looked up and found to have
// been migrated, looks up a batch of the ids found by the scan in the LocalUserIndex, or scans a
// batch of events. This can be removed once it has completed in every MultiUser canister.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_ids_in_events_migration.is_complete() {
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
    trace!("'update_user_ids_in_events' job running");
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

    TIMER_ID.set(None);
    read_state(start_job_if_required);
}

// Updates a batch of the events queued after a lookup if there are any, otherwise returns the next
// ids to look up if there are any, otherwise scans a batch of events
fn run_batch(state: &mut RuntimeState) -> Option<(Vec<UserId>, CanisterId)> {
    if state.data.user_ids_in_events_migration.has_events_to_update() {
        update_events(state);
        return None;
    }
    let user_ids = state
        .data
        .user_ids_in_events_migration
        .user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP);
    if !user_ids.is_empty() {
        return Some((user_ids, state.data.local_user_index_canister_id));
    }
    scan_batch(state);
    None
}

fn record_lookup(user_ids: &[UserId], migrated: HashMap<UserId, UserId>, state: &mut RuntimeState) {
    let data = &mut state.data;
    data.user_ids_in_events_migration
        .record_lookup(user_ids, &migrated, &mut data.migrated_user_ids);

    info!(
        looked_up = user_ids.len(),
        migrated = migrated.len(),
        "Looked up user ids found in events in the LocalUserIndex"
    );
}

fn scan_batch(state: &mut RuntimeState) {
    let data = &mut state.data;
    let migration = &mut data.user_ids_in_events_migration;
    scan(&mut data.users, migration, &data.migrated_user_ids, &mut || {
        ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH
    });

    if migration.is_scan_complete() {
        info!(metrics = ?migration.metrics(), "Finished scanning events for migrated user ids");
    }
}

// Scans the users' direct chats, carrying on from where the last batch got to, until `should_stop`
// returns true
fn scan(
    users: &mut Users,
    migration: &mut UserIdsInEventsMigration<(u16, u32, EventContext)>,
    migrated_user_ids: &MigratedUserIds,
    should_stop: &mut dyn FnMut() -> bool,
) {
    let cursor = migration.scanned_up_to();
    let mut from = cursor.map_or(0, |(user_index, _, _)| user_index);
    let mut scanned_up_to = None;

    while let Some(user_index) = users.next_index(from) {
        // Where to carry on from within the user's chats, if the last batch stopped part way through
        // them
        let start = cursor
            .filter(|(i, _, _)| *i == user_index)
            .map(|(_, key_id, context)| (key_id, context));

        let stopped_at = users
            .with_user_mut(user_index, |user| {
                for (key_id, chat_id) in user.direct_chats.ids_ordered_by_key_id() {
                    let after = match start {
                        Some((start_key_id, _)) if key_id < start_key_id => continue,
                        Some((start_key_id, context)) if key_id == start_key_id => Some(context),
                        _ => None,
                    };
                    let Some(mut chat) = user.direct_chats.get_mut(&chat_id) else {
                        continue;
                    };
                    if let Some(context) = chat.update_user_ids_in_events(
                        after,
                        &mut |context, user_id| {
                            migration.latest_user_id(user_id, (user_index, key_id, context), migrated_user_ids)
                        },
                        should_stop,
                    ) {
                        return Some((key_id, context));
                    }
                }
                None
            })
            .flatten();

        if let Some((key_id, context)) = stopped_at {
            scanned_up_to = Some((user_index, key_id, context));
            break;
        }
        let Some(next) = user_index.checked_add(1) else {
            break;
        };
        from = next;
    }
    migration.record_scanned_up_to(scanned_up_to);
}

fn update_events(state: &mut RuntimeState) {
    let data = &mut state.data;
    let migration = &mut data.user_ids_in_events_migration;
    let migrated_user_ids = &data.migrated_user_ids;

    let mut updated = 0;
    loop {
        let events = migration.take_events_to_update(100);
        if events.is_empty() {
            break;
        }
        let mut events_by_user: BTreeMap<u16, BTreeMap<u32, Vec<EventContext>>> = BTreeMap::new();
        for (user_index, key_id, context) in events {
            events_by_user
                .entry(user_index)
                .or_default()
                .entry(key_id)
                .or_default()
                .push(context);
        }
        for (user_index, events_by_chat) in events_by_user {
            data.users.with_user_mut(user_index, |user| {
                let chat_ids: HashMap<u32, ChatId> = user.direct_chats.ids_ordered_by_key_id().into_iter().collect();
                for (key_id, contexts) in events_by_chat {
                    let Some(mut chat) = chat_ids.get(&key_id).and_then(|chat_id| user.direct_chats.get_mut(chat_id)) else {
                        continue;
                    };
                    for context in contexts {
                        if chat.update_user_ids_in_event(context, &mut |user_id| migrated_user_ids.latest(user_id)) {
                            updated += 1;
                        }
                    }
                }
            });
        }
        if ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH {
            break;
        }
    }
    migration.record_events_updated(updated);

    info!(updated, "Updated events holding user ids found to have been migrated");
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use chat_events::{MessageContentInternal, NullEventPusher, PushMessageArgs, Reader, TextContentInternal};
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::{MessageId, MessageIndex, UserType};

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn old_user_id() -> UserId {
        user_id(100)
    }

    fn new_user_id() -> UserId {
        user_id(101)
    }

    // User 1 has two chats holding messages from the migrated user's old id, of 150 and 30
    // messages, user 2 has none and user 3 has one of 50 messages
    fn setup() -> (Users, MigratedUserIds) {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_multi_user(memory_manager.get(MemoryId::new(0)), memory_manager.get(MemoryId::new(1)));

        let mut users = Users::default();
        for i in 1..=3 {
            users.add(Principal::from_slice(&[i]), format!("user{i}"), None, 0).unwrap();
        }
        push_messages(&mut users, 1, user_id(10), 150);
        push_messages(&mut users, 1, user_id(11), 30);
        push_messages(&mut users, 3, user_id(12), 50);

        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(old_user_id(), new_user_id());
        (users, migrated_user_ids)
    }

    fn push_messages(users: &mut Users, user_index: u16, them: UserId, count: u32) {
        users.with_user_mut(user_index, |user| {
            let mut chat = user
                .direct_chats
                .get_or_create(user_id(user_index as u8), them, UserType::User, || 0, 0);
            for i in 0..count {
                chat.push_message::<NullEventPusher>(
                    PushMessageArgs {
                        sender: old_user_id(),
                        thread_root_message_index: None,
                        message_id: MessageId::from(i as u64),
                        content: MessageContentInternal::Text(TextContentInternal { text: "hi".to_string() }),
                        sender_context: None,
                        mentioned: Vec::new(),
                        replies_to: None,
                        forwarded: false,
                        sender_is_bot: false,
                        block_level_markdown: false,
                        og_previews: Vec::new(),
                        now: 1,
                    },
                    None,
                    None,
                );
            }
        });
    }

    // The senders of each message in the user's chat with `them`
    fn senders(users: &Users, user_index: u16, them: UserId) -> Vec<UserId> {
        users
            .with_user(user_index, |user| {
                let chat = user.direct_chats.get(&them.into()).unwrap();
                let reader = chat.main_events_reader();
                (0u32..)
                    .map_while(|i| reader.message_internal(MessageIndex::from(i).into()))
                    .map(|m| m.sender)
                    .collect()
            })
            .unwrap()
    }

    // Runs batches which each stop as soon as they can, until the scan is complete, returning how
    // many it took
    fn scan_to_completion(
        users: &mut Users,
        migration: &mut UserIdsInEventsMigration<(u16, u32, EventContext)>,
        migrated_user_ids: &MigratedUserIds,
    ) -> usize {
        let mut batches = 0;
        while !migration.is_scan_complete() {
            scan(users, migration, migrated_user_ids, &mut || true);
            batches += 1;
        }
        batches
    }

    #[test]
    fn every_chat_of_every_user_is_scanned_a_batch_at_a_time() {
        let (mut users, migrated_user_ids) = setup();
        let mut migration = UserIdsInEventsMigration::default();

        let batches = scan_to_completion(&mut users, &mut migration, &migrated_user_ids);

        // Each chat's events are scanned 100 at a time, its first event being when it was created,
        // then a last batch finds nothing left to scan
        assert_eq!(batches, 2 + 1 + 1 + 1);
        assert_eq!(senders(&users, 1, user_id(10)), vec![new_user_id(); 150]);
        assert_eq!(senders(&users, 1, user_id(11)), vec![new_user_id(); 30]);
        assert_eq!(senders(&users, 3, user_id(12)), vec![new_user_id(); 50]);
        assert!(migration.is_complete());
    }

    #[test]
    fn the_scan_carries_on_if_the_chat_it_stopped_in_is_deleted() {
        let (mut users, migrated_user_ids) = setup();
        let mut migration = UserIdsInEventsMigration::default();

        scan(&mut users, &mut migration, &migrated_user_ids, &mut || true);
        assert!(matches!(migration.scanned_up_to(), Some((1, 1, _))));
        users.with_user_mut(1, |user| user.direct_chats.remove(user_id(10).into(), 2));

        scan_to_completion(&mut users, &mut migration, &migrated_user_ids);

        assert_eq!(senders(&users, 1, user_id(11)), vec![new_user_id(); 30]);
        assert_eq!(senders(&users, 3, user_id(12)), vec![new_user_id(); 50]);
    }

    #[test]
    fn the_scan_carries_on_if_the_user_it_stopped_at_is_deleted() {
        let (mut users, migrated_user_ids) = setup();
        let mut migration = UserIdsInEventsMigration::default();

        scan(&mut users, &mut migration, &migrated_user_ids, &mut || true);
        users.remove(1);

        scan_to_completion(&mut users, &mut migration, &migrated_user_ids);

        assert_eq!(senders(&users, 3, user_id(12)), vec![new_user_id(); 50]);
    }
}
