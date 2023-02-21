use crate::guards::caller_is_storage_index_canister;
use crate::model::files::RemoveFileResult;
use crate::model::index_sync_state::EventToSync;
use crate::{mutate_state, RuntimeState, MAX_EVENTS_TO_SYNC_PER_BATCH};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_bucket_canister::c2c_sync_index::{Response::*, *};
use types::FileRemoved;

#[update(guard = "caller_is_storage_index_canister")]
#[trace]
fn c2c_sync_index(args: Args) -> Response {
    mutate_state(|state| c2c_sync_index_impl(args, state))
}

fn c2c_sync_index_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for user_id in args.users_added {
        runtime_state.data.users.add(user_id);
    }

    let mut files_removed: Vec<FileRemoved> = Vec::new();

    for user_id in args.users_removed {
        if let Some(user) = runtime_state.data.users.remove(&user_id) {
            for file_id in user.files_owned() {
                if let RemoveFileResult::Success(b) = runtime_state.data.files.remove(user_id, file_id) {
                    files_removed.push(b)
                }
            }
        }
    }

    for accessor_id in args.accessors_removed {
        files_removed.extend(runtime_state.data.files.remove_accessor(&accessor_id));
    }

    for file_id in args.files_to_remove {
        if let RemoveFileResult::Success(file_removed) = runtime_state.data.files.remove_unchecked(file_id) {
            files_removed.push(file_removed);
        }
    }

    if files_removed.len() > MAX_EVENTS_TO_SYNC_PER_BATCH {
        // If there are too many events to sync in a single batch, queue the excess events to be
        // synced later via heartbeat
        let excess = files_removed.split_off(MAX_EVENTS_TO_SYNC_PER_BATCH);

        for removed in excess {
            runtime_state.data.index_sync_state.enqueue(EventToSync::FileRemoved(removed));
        }
    }

    for (old_user_id, new_user_id) in args.user_ids_updated {
        if runtime_state.data.users.update_user_id(old_user_id, new_user_id) {
            let user = runtime_state.data.users.get(&new_user_id).unwrap();
            for file_id in user.files_owned() {
                runtime_state.data.files.update_owner(&file_id, new_user_id);
            }
            runtime_state.data.files.update_accessor_id(old_user_id, new_user_id);
        }
    }

    Success(SuccessResult { files_removed })
}
