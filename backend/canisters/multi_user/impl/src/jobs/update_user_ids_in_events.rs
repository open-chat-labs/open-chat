use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::{BTreeMap, HashMap};
use std::time::Duration;
use tracing::{error, info, trace};
use types::{ChatId, EventContext, UserId};

const MAX_INSTRUCTIONS_PER_BATCH: u64 = 2_000_000_000;
const MAX_USER_IDS_PER_LOOKUP: usize = 5_000;
const LOOKUP_RETRY_DELAY: Duration = Duration::from_secs(60);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Replaces the ids users had before being migrated to MultiUser canisters with their latest ids in
// the events of every user's direct chats (see `UserIdsInEventsMigration`), scanning the users in
// order of index and each user's chats in order of key_id. Each run either scans a batch of events,
// or, if any ids found by the scan are waiting to be looked up in the LocalUserIndex, looks up a
// batch of those and updates the events they are in. This can be removed once it has completed in
// every MultiUser canister.
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

    let (user_ids, local_user_index_canister_id) = read_state(|state| {
        (
            state
                .data
                .user_ids_in_events_migration
                .user_ids_to_look_up(MAX_USER_IDS_PER_LOOKUP),
            state.data.local_user_index_canister_id,
        )
    });

    if user_ids.is_empty() {
        mutate_state(scan_batch);
    } else {
        let args = local_user_index_canister::migrated_user_ids::Args {
            user_ids: user_ids.clone(),
        };
        match local_user_index_canister_c2c_client::migrated_user_ids(local_user_index_canister_id, &args).await {
            Ok(local_user_index_canister::migrated_user_ids::Response::Success(migrated)) => {
                mutate_state(|state| update_events(&user_ids, migrated, state))
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

fn scan_batch(state: &mut RuntimeState) {
    let data = &mut state.data;
    let migration = &mut data.user_ids_in_events_migration;
    let migrated_user_ids = &data.migrated_user_ids;
    let should_stop = &mut || ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH;

    let cursor = migration.scanned_up_to();
    let mut from = cursor.map_or(0, |(user_index, _, _)| user_index);
    let mut scanned_up_to = None;

    while let Some(user_index) = data.users.next_index(from) {
        // Where to carry on from within the user's chats, if the last batch stopped part way through
        // them
        let start = cursor
            .filter(|(i, _, _)| *i == user_index)
            .map(|(_, key_id, context)| (key_id, context));

        let stopped_at = data
            .users
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

    if migration.is_scan_complete() {
        info!(metrics = ?migration.metrics(), "Finished scanning events for migrated user ids");
    }
}

fn update_events(user_ids: &[UserId], migrated: HashMap<UserId, UserId>, state: &mut RuntimeState) {
    let data = &mut state.data;
    let events = data
        .user_ids_in_events_migration
        .record_lookup(user_ids, &migrated, &mut data.migrated_user_ids);

    let mut events_by_user: BTreeMap<u16, BTreeMap<u32, Vec<EventContext>>> = BTreeMap::new();
    for (user_index, key_id, context) in events {
        events_by_user
            .entry(user_index)
            .or_default()
            .entry(key_id)
            .or_default()
            .push(context);
    }

    let migrated_user_ids = &data.migrated_user_ids;
    let mut updated = 0;
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
    data.user_ids_in_events_migration.record_events_updated(updated);

    info!(
        looked_up = user_ids.len(),
        migrated = migrated.len(),
        updated,
        "Updated the events of migrated user ids looked up in the LocalUserIndex"
    );
}
