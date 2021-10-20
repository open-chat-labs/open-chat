use crate::Data;
use utils::regular_jobs::{RegularJob, RegularJobs};
use utils::time::MINUTE_IN_MS;

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance".to_owned(), check_cycles_balance, MINUTE_IN_MS);
    let aggregate_direct_chat_metrics = RegularJob::new(
        "Aggregate direct chat metrics".to_owned(),
        aggregate_direct_chat_metrics,
        5 * MINUTE_IN_MS,
    );

    RegularJobs::new(vec![check_cycles_balance, aggregate_direct_chat_metrics])
}

fn check_cycles_balance(data: &mut Data) {
    let group_index_canister_id = data.group_index_canister_id;
    let user_cycles_balance = data.user_cycles_balance.value();
    cycles_utils::check_cycles_balance(user_cycles_balance, group_index_canister_id);
}

fn aggregate_direct_chat_metrics(data: &mut Data) {
    data.direct_chats.aggregate_metrics();
}
