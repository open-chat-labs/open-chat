use crate::model::users::FileStatusInternal;
use crate::{mutate_state, Data, RuntimeState, DATA_LIMIT_BYTES};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use storage_index_canister::c2c_sync_bucket::{Args, Response, SuccessResult};
use tracing::trace;
use types::CanisterId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(data: &Data) -> bool {
    if TIMER_ID.get().is_none() && !data.index_sync_state.is_empty() && !data.index_sync_state.in_progress() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'sync_index' job running");
    TIMER_ID.set(None);

    if let Some((canister_id, args)) = mutate_state(next_batch) {
        ic_cdk::spawn(send_to_index(canister_id, args));
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<(CanisterId, Args)> {
    let bytes_used = state.data.files.bytes_used();
    let bytes_remaining = (DATA_LIMIT_BYTES as i64) - (bytes_used as i64);

    state
        .data
        .index_sync_state
        .pop_args_for_next_sync(bytes_used, bytes_remaining)
        .map(|args| (state.data.storage_index_canister_id, args))
}

async fn send_to_index(storage_index_canister_id: CanisterId, args: Args) {
    let response = storage_index_canister_c2c_client::c2c_sync_bucket(storage_index_canister_id, &args).await;
    mutate_state(|state| {
        match response {
            Ok(Response::Success(result)) => handle_success(result, state),
            Err(_) => handle_error(args, state),
        }
        start_job_if_required(&state.data);
    });
}

fn handle_success(result: SuccessResult, state: &mut RuntimeState) {
    // For each file that is rejected by the index canister we want to do 2 things -
    // 1. Record the reason against the user so that they can determine what happened
    // 2. Delete any additional data we have held for that file
    for file in result.files_rejected {
        let file_id = file.file_id;
        let reason = file.reason.into();

        if let Some(user_id) = state.data.files.owner(&file.file_id) {
            if let Some(user) = state.data.users.get_mut(&user_id) {
                let old_status = user.set_file_status(file_id, FileStatusInternal::Rejected(reason));

                if let Some(FileStatusInternal::Uploading(_)) = old_status {
                    state.data.files.remove_pending_file(&file_id);
                } else {
                    state.data.files.remove(user_id, file_id);
                }
            }
        }
    }

    state.data.index_sync_state.mark_sync_completed();
}

fn handle_error(args: Args, state: &mut RuntimeState) {
    state.data.index_sync_state.mark_sync_failed(args);
}
