use crate::Data;
use constants::{MINUTE_IN_MS, multi_user_canister_min_cycles_balance};
use utils::env::Environment;
use utils::regular_jobs::{RegularJob, RegularJobs};

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance", check_cycles_balance, 5 * MINUTE_IN_MS);
    RegularJobs::new(vec![check_cycles_balance])
}

// Asks the LocalUserIndex for a top up when the balance runs low, as the User canister does, but
// keeping a larger balance since this canister hosts many users
fn check_cycles_balance(_: &dyn Environment, data: &mut Data) {
    utils::cycles::check_cycles_balance_with_min(
        data.local_user_index_canister_id,
        multi_user_canister_min_cycles_balance(data.test_mode),
    );
}
