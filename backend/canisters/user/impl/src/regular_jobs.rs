use crate::group_summaries::{build_summaries_args, SummariesArgs};
use crate::{can_borrow_state, mutate_state, CachedGroupSummaries, Data};
use utils::env::Environment;
use utils::regular_jobs::{RegularJob, RegularJobs};
use utils::time::{MINUTE_IN_MS, WEEK_IN_MS};

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance", check_cycles_balance, 5 * MINUTE_IN_MS);
    let aggregate_direct_chat_metrics = RegularJob::new(
        "Aggregate direct chat metrics",
        aggregate_direct_chat_metrics,
        5 * MINUTE_IN_MS,
    );
    let retry_deleting_files = RegularJob::new("Retry deleting files", retry_deleting_files, MINUTE_IN_MS);
    let update_cached_group_summaries =
        RegularJob::new("Update cached group summaries", update_cached_group_summaries, WEEK_IN_MS);

    RegularJobs::new(vec![
        check_cycles_balance,
        aggregate_direct_chat_metrics,
        retry_deleting_files,
        update_cached_group_summaries,
    ])
}

fn check_cycles_balance(_: &dyn Environment, data: &mut Data) {
    utils::cycles::check_cycles_balance(data.local_user_index_canister_id);
}

fn aggregate_direct_chat_metrics(_: &dyn Environment, data: &mut Data) {
    data.direct_chats.aggregate_metrics();
}

fn retry_deleting_files(_: &dyn Environment, _: &mut Data) {
    storage_bucket_client::retry_failed();
}

fn update_cached_group_summaries(env: &dyn Environment, data: &mut Data) {
    let summaries_args = build_summaries_args(false, env.now(), data);

    ic_cdk::spawn(update_cached_group_summaries_impl(summaries_args));
}

async fn update_cached_group_summaries_impl(args: SummariesArgs) {
    if let Ok(summaries) = crate::group_summaries::summaries(args).await {
        // We need this check because the call to `summaries` may have been synchronous in which
        // case we still hold the borrow on `data` which was passed into
        // `update_cached_group_summaries`.
        if can_borrow_state() {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.cached_group_summaries = Some(CachedGroupSummaries {
                    groups: summaries
                        .into_iter()
                        // This ensures we don't cache any groups which have been deleted or the
                        // user has been removed from, which they were members of at the beginning
                        // of this async operation.
                        .filter(|g| state.data.group_chats.exists(&g.chat_id))
                        .collect(),
                    timestamp: now,
                });
            });
        }
    }
}
