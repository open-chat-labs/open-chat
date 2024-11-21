use crate::Data;
use utils::env::Environment;
use utils::regular_jobs::{RegularJob, RegularJobs};
use utils::time::MINUTE_IN_MS;

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance", check_cycles_balance, 5 * MINUTE_IN_MS);
    let aggregate_direct_chat_metrics = RegularJob::new(
        "Aggregate direct chat metrics",
        aggregate_direct_chat_metrics,
        5 * MINUTE_IN_MS,
    );
    RegularJobs::new(vec![check_cycles_balance, aggregate_direct_chat_metrics])
}

fn check_cycles_balance(_: &dyn Environment, data: &mut Data) {
    utils::cycles::check_cycles_balance(data.local_user_index_canister_id);
}

fn aggregate_direct_chat_metrics(_: &dyn Environment, data: &mut Data) {
    data.direct_chats.aggregate_metrics();
}
