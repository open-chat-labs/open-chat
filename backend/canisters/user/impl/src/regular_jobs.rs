use crate::group_summaries::{build_args_using_cache, UpdatesArgs};
use crate::{mutate_state, CachedGroupSummaries, Data};
use utils::env::Environment;
use utils::regular_jobs::{RegularJob, RegularJobs};
use utils::time::{DAY_IN_MS, MINUTE_IN_MS};

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
    let group_index_canister_id = data.group_index_canister_id;
    let user_cycles_balance = data.user_cycles_balance.value();
    utils::cycles::check_cycles_balance(user_cycles_balance, group_index_canister_id);
}

fn aggregate_direct_chat_metrics(_: &dyn Environment, data: &mut Data) {
    data.direct_chats.aggregate_metrics();
}

fn retry_deleting_files(_: &dyn Environment, _: &mut Data) {
    open_storage_bucket_client::retry_failed();
}

fn update_cached_group_summaries(env: &dyn Environment, data: &mut Data) {
    let updates_args = build_args_using_cache(env.now(), data);

    ic_cdk::spawn(update_cached_group_summaries_impl(updates_args));
}

async fn update_cached_group_summaries_impl(args: UpdatesArgs) {
    if let Ok(group_chat_details) = crate::group_summaries::updates(args).await {
        if !group_chat_details.added.is_empty() && group_chat_details.upgrades_in_progress.is_empty() {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.cached_group_summaries = Some(CachedGroupSummaries {
                    groups: group_chat_details.added,
                    timestamp: now,
                });
            });
        }
    }
}
