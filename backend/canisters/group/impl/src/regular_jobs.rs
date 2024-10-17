use crate::Data;
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
    data.chat.events.migrate_next_batch_of_events_to_stable_storage();
}
