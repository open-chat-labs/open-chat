use crate::{mutate_state, Data};
use types::{CanisterId, Empty};
use utils::env::Environment;
use utils::regular_jobs::{RegularJob, RegularJobs};
use utils::time::MINUTE_IN_MS;

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance", check_cycles_balance, 5 * MINUTE_IN_MS);
    let retry_deleting_files = RegularJob::new("Retry deleting files", retry_deleting_files, MINUTE_IN_MS);
    let migrate_chat_events_to_stable_memory = RegularJob::new("Migrate chat events", migrate_chat_events_to_stable_memory, 0);

    RegularJobs::new(vec![
        check_cycles_balance,
        retry_deleting_files,
        migrate_chat_events_to_stable_memory,
    ])
}

fn check_cycles_balance(_: &dyn Environment, data: &mut Data) {
    utils::cycles::check_cycles_balance(data.local_group_index_canister_id);
}

fn retry_deleting_files(_: &dyn Environment, _: &mut Data) {
    storage_bucket_client::retry_failed();
}

fn migrate_chat_events_to_stable_memory(_: &dyn Environment, data: &mut Data) {
    if !data.stable_memory_event_migration_complete {
        let (_, finished) = data.chat.events.migrate_next_batch_of_events_to_stable_storage();
        if finished {
            ic_cdk::spawn(notify_migration_to_stable_memory_complete(data.local_group_index_canister_id));
        }
    }
}

async fn notify_migration_to_stable_memory_complete(local_group_index: CanisterId) {
    if local_group_index_canister_c2c_client::c2c_mark_events_migrated_to_stable_memory(local_group_index, &Empty {})
        .await
        .is_ok()
    {
        mutate_state(|state| state.data.stable_memory_event_migration_complete = true);
    }
}
