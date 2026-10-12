use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{error, info, trace};
use types::UserId;

const MAX_INSTRUCTIONS_PER_BATCH: u64 = 2_000_000_000;
const MAX_USER_IDS_PER_LOOKUP: usize = 5_000;
const LOOKUP_RETRY_DELAY: Duration = Duration::from_secs(60);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Replaces the ids users had before being migrated to MultiUser canisters with their latest ids in
// every event (see `UserIdsInEventsMigration`). Each run either scans a batch of events, or, if any
// ids found by the scan are waiting to be looked up in the LocalUserIndex, looks up a batch of
// those and updates the events they are in. This can be removed once it has completed in every
// group.
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

    let scanned_up_to = data.chat.events.update_user_ids(
        migration.scanned_up_to(),
        &mut |context, user_id| migration.latest_user_id(user_id, context, migrated_user_ids),
        &mut || ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_BATCH,
    );
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

    let migrated_user_ids = &data.migrated_user_ids;
    let mut updated = 0;
    for context in events {
        if data
            .chat
            .events
            .update_user_ids_in_event(context, &mut |user_id| migrated_user_ids.latest(user_id))
        {
            updated += 1;
        }
    }
    data.user_ids_in_events_migration.record_events_updated(updated);

    info!(
        looked_up = user_ids.len(),
        migrated = migrated.len(),
        updated,
        "Updated the events of migrated user ids looked up in the LocalUserIndex"
    );
}
