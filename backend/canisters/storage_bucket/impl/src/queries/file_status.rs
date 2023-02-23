use crate::guards::caller_is_known_user;
use crate::model::users::{FileStatusInternal, IndexSyncComplete};
use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_bucket_canister::file_status::{Response::*, *};
use types::{FileStatus, FileStatusCompleted, FileStatusRejected, FileStatusUploading};

#[update(guard = "caller_is_known_user")]
#[trace]
fn file_status(args: Args) -> Response {
    read_state(|state| file_status_impl(args, state))
}

fn file_status_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let user = runtime_state.data.users.get(&caller).unwrap();

    if let Some(status_internal) = user.file_status(&args.file_id) {
        let status = match status_internal {
            FileStatusInternal::Complete(c) => {
                let file = runtime_state.data.files.get(&args.file_id).unwrap_or_else(|| {
                    panic!("Data inconsistency. File not found. FileId: {}", args.file_id);
                });

                FileStatus::Completed(FileStatusCompleted {
                    created: file.created,
                    index_sync_complete: matches!(c, IndexSyncComplete::Yes),
                    mime_type: file.mime_type.clone(),
                    size: runtime_state.data.files.data_size(&file.hash).unwrap_or_default(),
                })
            }
            FileStatusInternal::Uploading(c) => {
                let pending_file = runtime_state.data.files.pending_file(&args.file_id).unwrap_or_else(|| {
                    panic!("Data inconsistency. Pending file not found. FileId: {}", args.file_id);
                });

                FileStatus::Uploading(FileStatusUploading {
                    created: pending_file.created,
                    index_sync_complete: matches!(c, IndexSyncComplete::Yes),
                    mime_type: pending_file.mime_type.clone(),
                    size: pending_file.total_size,
                    chunk_size: pending_file.chunk_size,
                    chunks_remaining: pending_file.remaining_chunks.iter().copied().collect(),
                })
            }
            FileStatusInternal::Rejected(r) => FileStatus::Rejected(FileStatusRejected { reason: *r }),
        };

        Success(SuccessResult { status })
    } else {
        NotFound
    }
}
