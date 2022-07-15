use crate::Data;
use utils::regular_jobs::RegularJobs;

pub(crate) fn build() -> RegularJobs<Data> {
    let check_cycles_balance = RegularJob::new("Check cycles balance", check_cycles_balance, MINUTE_IN_MS);
    let aggregate_direct_chat_metrics = RegularJob::new(
        "Aggregate direct chat metrics",
        aggregate_direct_chat_metrics,
        5 * MINUTE_IN_MS,
    );
    let retry_deleting_files = RegularJob::new("Retry deleting files", retry_deleting_files, MINUTE_IN_MS);
    let update_cached_group_summaries =
        RegularJob::new("Update cached group summaries", update_cached_group_summaries, DAY_IN_MS);

    RegularJobs::new(vec![
        check_cycles_balance,
        aggregate_direct_chat_metrics,
        retry_deleting_files,
        update_cached_group_summaries,
    ])
}

fn check_cycles_balance(_: &dyn Environment, data: &mut Data) {
    let user_index_canister_id = data.user_index_canister_id;
    utils::cycles::check_cycles_balance(user_index_canister_id);
}

fn aggregate_direct_chat_metrics(_: &dyn Environment, data: &mut Data) {
    data.direct_chats.aggregate_metrics();
}

fn retry_deleting_files(_: &dyn Environment, _: &mut Data) {
    open_storage_bucket_client::retry_failed();
}

fn update_cached_group_summaries(env: &dyn Environment, data: &mut Data) {
    let summaries_args = build_summaries_args(env.now(), data);

    ic_cdk::spawn(update_cached_group_summaries_impl(summaries_args));
}

async fn update_cached_group_summaries_impl(args: SummariesArgs) {
    if let Ok(summaries) = crate::group_summaries::summaries(args).await {
        if !summaries.groups.is_empty() && summaries.upgrades_in_progress.is_empty() {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.cached_group_summaries = Some(CachedGroupSummaries {
                    groups: summaries.groups,
                    timestamp: now,
                });
            });
        }
    }
}
