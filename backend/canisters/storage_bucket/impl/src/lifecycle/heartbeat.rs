use crate::model::users::FileStatusInternal;
use crate::{mutate_state, RuntimeState, DATA_LIMIT_BYTES};
use ic_cdk_macros::heartbeat;
use storage_index_canister::c2c_sync_bucket::{Args, Response, SuccessResult};
use types::CanisterId;

#[heartbeat]
fn heartbeat() {
    sync_index::run();
    remove_expired_files::run();
}

mod sync_index {
    use super::*;

    pub fn run() {
        if let Some((index_canister_id, args)) = mutate_state(next_batch) {
            ic_cdk::spawn(send_to_index(index_canister_id, args));
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
        match storage_index_canister_c2c_client::c2c_sync_bucket(storage_index_canister_id, &args).await {
            Ok(Response::Success(result)) => {
                mutate_state(|state| handle_success(result, state));
            }
            Err(_) => {
                mutate_state(|state| handle_error(args, state));
            }
        }
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
}

mod remove_expired_files {
    use crate::{mutate_state, EventToSync};

    pub fn run() {
        mutate_state(|state| {
            let now = state.env.now();
            for file in state.data.files.remove_expired_files(now, 10) {
                state.data.index_sync_state.enqueue(EventToSync::FileRemoved(file));
            }
        });
    }
}
