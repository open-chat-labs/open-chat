use crate::updates::c2c_notify_low_balance::top_up_cycles;
use crate::{mutate_state, Data, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use storage_bucket_canister::c2c_sync_index::{Args, Response, SuccessResult};
use tracing::trace;
use types::CanisterId;
use utils::cycles::is_out_of_cycles_error;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(data: &Data) -> bool {
    if TIMER_ID.get().is_none()
        && (data.canisters_requiring_upgrade.count_pending() > 0 || data.canisters_requiring_upgrade.count_in_progress() > 0)
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'sync_buckets' job started");
        true
    } else {
        false
    }
}

fn run() {
    if let Some(batch) = mutate_state(next_batch) {
        for (canister_id, args) in batch {
            ic_cdk::spawn(send_to_bucket(canister_id, args));
        }
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'sync_buckets' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(CanisterId, Args)>> {
    state.data.buckets.pop_args_for_next_sync()
}

async fn send_to_bucket(canister_id: CanisterId, args: Args) {
    match storage_bucket_canister_c2c_client::c2c_sync_index(canister_id, &args).await {
        Ok(Response::Success(result)) => {
            mutate_state(|state| handle_success(canister_id, result, state));
        }
        Err((code, msg)) => {
            if is_out_of_cycles_error(code, &msg) {
                // Canister is out of cycles
                top_up_cycles(Some(canister_id)).await;
            }
            mutate_state(|state| handle_error(canister_id, args, state));
        }
    }
}

fn handle_success(canister_id: CanisterId, result: SuccessResult, state: &mut RuntimeState) {
    for file in result.files_removed {
        state.data.remove_file_reference(canister_id, file);
    }

    if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
        bucket.sync_state.mark_sync_completed();
    }
}

fn handle_error(canister_id: CanisterId, args: Args, state: &mut RuntimeState) {
    if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
        bucket.sync_state.mark_sync_failed(args);
    }
}
