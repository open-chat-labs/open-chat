use crate::Data;
use utils::env::Environment;
use utils::regular_jobs::{RegularJob, RegularJobs};
use utils::time::MINUTE_IN_MS;

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance", check_cycles_balance, 5 * MINUTE_IN_MS);
    let retry_deleting_files = RegularJob::new("Retry deleting files", retry_deleting_files, MINUTE_IN_MS);

    RegularJobs::new(vec![check_cycles_balance, retry_deleting_files])
}

fn check_cycles_balance(_: &dyn Environment, data: &mut Data) {
    utils::cycles::check_cycles_balance(data.local_group_index_canister_id);
}

fn retry_deleting_files(_: &dyn Environment, _: &mut Data) {
    open_storage_bucket_client::retry_failed();
}
