use crate::Data;
use utils::regular_jobs::{RegularJob, RegularJobs};
use utils::time::MINUTE_IN_MS;

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance".to_owned(), check_cycles_balance, MINUTE_IN_MS);

    RegularJobs::new(vec![check_cycles_balance])
}

fn check_cycles_balance(data: &mut Data) {
    let group_index_canister_id = data.group_index_canister_id;
    cycles_utils::check_cycles_balance(0, group_index_canister_id);
}
