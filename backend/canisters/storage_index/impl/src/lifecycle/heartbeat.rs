use crate::{mutate_state, RuntimeState};
use ic_cdk::heartbeat;
use storage_bucket_canister::c2c_sync_index::{Args, Response, SuccessResult};
use types::CanisterId;

#[heartbeat]
fn heartbeat() {
    sync_buckets::run();
}

mod sync_buckets {
    use super::*;
    use crate::updates::c2c_notify_low_balance::top_up_cycles;
    use utils::cycles::is_out_of_cycles_error;

    pub fn run() {
        for (canister_id, args) in mutate_state(next_batch) {
            ic_cdk::spawn(send_to_bucket(canister_id, args));
        }
    }

    fn next_batch(state: &mut RuntimeState) -> Vec<(CanisterId, Args)> {
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
}
