use crate::Data;
use constants::MINUTE_IN_MS;
use utils::env::Environment;
use utils::regular_jobs::{RegularJob, RegularJobs};

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance", check_cycles_balance, 5 * MINUTE_IN_MS);

    RegularJobs::new(vec![check_cycles_balance])
}

fn check_cycles_balance(_: &dyn Environment, data: &mut Data) {
    utils::cycles::check_cycles_balance(data.local_group_index_canister_id);
}
