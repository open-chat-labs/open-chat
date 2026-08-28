use crate::guards::caller_is_known_user;
use crate::model::files::{PutChunkArgs, PutChunkResult};
use crate::model::index_event_batch::EventToSync;
use crate::model::users::{FileStatusInternal, IndexSyncComplete};
use crate::{RuntimeState, check_cycles_balance, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_bucket_canister::upload_chunk_v2::{Response::*, *};
use storage_index_canister::c2c_sync_bucket::{CsamMatch, CsamMatchKind};
use types::{FileRemoved, RejectedReason};
use utils::file_id::validate_file_id;

#[update(guard = "caller_is_known_user", candid = true, json = true, msgpack = true)]
#[trace]
fn upload_chunk_v2(args: Args) -> Response {
    check_cycles_balance();

    mutate_state(|state| upload_chunk_impl(args, state))
}

fn upload_chunk_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = state.env.caller();
    let now = state.env.now();
    let user = state.data.users.get(&user_id).unwrap();
    let file_id = args.file_id;

    if !validate_file_id(file_id, state.env.canister_id()) {
        return InvalidFileId;
    }

    // Content previously upheld as CSAM can never be uploaded again: the upload is refused
    // outright - so no message referencing it can ever be created - and the user_index is
    // told so the uploader receives the same sanction as the original sender. Checking the
    // declared hash is airtight: an upload only ever completes if the bytes hash to the
    // declared value (see the HashMismatch arm below).
    if let Some(report_index) = state.data.vault.known_csam_report_index(&args.hash) {
        // Report once per file id: chunks upload in parallel and each is refused here, and a
        // retry of the same attempt reuses the file id - only the first sighting is reported
        if state.data.vault.record_blocked_attempt(user_id, file_id, args.hash) {
            state.data.push_event_to_index(EventToSync::CsamMatch(CsamMatch {
                uploader: user_id,
                file_id,
                hash: args.hash,
                csam_report_index: report_index,
                kind: CsamMatchKind::UploadAttempt,
            }));
        }
        return Blocked;
    }

    // Content quarantined pending a verdict is refused the same way: the bucket will not
    // serve it, so handing out a fresh reference would only create a message nobody can view
    // while the re-share attempt itself went unrecorded. Reported against the pending report;
    // a pin retained only by a legal hold has no active claim, so the upload is refused
    // without reporting or sanctioning anyone against the already-resolved report.
    if state.data.files.is_vault_pinned(&args.hash) {
        if let Some(report_index) = state.data.vault.pinned_report_index(&args.hash)
            && state.data.vault.record_blocked_attempt(user_id, file_id, args.hash)
        {
            state.data.push_event_to_index(EventToSync::CsamMatch(CsamMatch {
                uploader: user_id,
                file_id,
                hash: args.hash,
                csam_report_index: report_index,
                kind: CsamMatchKind::PendingQuarantineAttempt,
            }));
        }
        return Blocked;
    }

    // A client-side transcode (video re-encoded at upload) never reproduces the hash of the
    // bytes it started from, so the client also declares that source hash, and it is checked
    // against the denylist like the stored hash: a verdict on a transcoded copy denylists its
    // source hashes too (see c2c_vault_sync). Not airtight the way `hash` is - the bucket
    // cannot verify the source bytes - but a client that lies about it only forfeits the
    // check, and one that omits it is treated exactly like one uploading the original.
    if let Some(source_hash) = args.source_hash
        && let Some(report_index) = state.data.vault.known_csam_report_index(&source_hash)
    {
        if state.data.vault.record_blocked_attempt(user_id, file_id, source_hash) {
            state.data.push_event_to_index(EventToSync::CsamMatch(CsamMatch {
                uploader: user_id,
                file_id,
                hash: source_hash,
                csam_report_index: report_index,
                kind: CsamMatchKind::UploadAttempt,
            }));
        }
        return Blocked;
    }

    // Pre-verdict, the pin sits on the transcoded bytes only, so either declared hash being a
    // recorded SOURCE of a pinned hash is refused the same way as the pinned hash itself: the
    // original file re-uploaded raw (`hash`), or re-transcoded to fresh bytes (`source_hash`)
    for declared in std::iter::once(args.hash).chain(args.source_hash) {
        if let Some(pinned_hash) = state.data.files.vault_pinned_hash_for_source(&declared) {
            if let Some(report_index) = state.data.vault.pinned_report_index(&pinned_hash)
                && state.data.vault.record_blocked_attempt(user_id, file_id, pinned_hash)
            {
                state.data.push_event_to_index(EventToSync::CsamMatch(CsamMatch {
                    uploader: user_id,
                    file_id,
                    hash: pinned_hash,
                    csam_report_index: report_index,
                    kind: CsamMatchKind::PendingQuarantineAttempt,
                }));
            }
            return Blocked;
        }
    }

    let mut index_sync_complete = IndexSyncComplete::No;
    let mut status = None;
    if let Some(status) = user.file_status(&file_id) {
        match status {
            FileStatusInternal::Complete(_) | FileStatusInternal::Rejected(RejectedReason::HashMismatch) => {
                return FileAlreadyExists;
            }
            FileStatusInternal::Rejected(RejectedReason::AllowanceExceeded) => return AllowanceExceeded,
            FileStatusInternal::Rejected(RejectedReason::UserNotFound) => return UserNotFound,
            FileStatusInternal::Rejected(RejectedReason::FileExpired) => return FileExpired,
            FileStatusInternal::Uploading(c) => index_sync_complete = *c,
        }
    } else if args.expiry.is_some_and(|e| e < now) {
        return FileExpired;
    } else {
        status = Some(FileStatusInternal::Uploading(IndexSyncComplete::No));
    }

    let response = match state.data.files.put_chunk(PutChunkArgs::new(user_id, args, now)) {
        PutChunkResult::Success(r) => {
            if r.file_completed {
                status = Some(FileStatusInternal::Complete(index_sync_complete));
            }
            if let Some(file_added) = r.file_added {
                state.data.push_event_to_index(EventToSync::FileAdded(file_added));
                crate::jobs::remove_expired_files::start_job_if_required(state);
            }
            Success
        }
        PutChunkResult::FileAlreadyExists => FileAlreadyExists,
        PutChunkResult::FileTooBig(_) => FileTooBig,
        PutChunkResult::FileExpired => {
            status = Some(FileStatusInternal::Rejected(RejectedReason::FileExpired));
            FileExpired
        }
        PutChunkResult::ChunkAlreadyExists => ChunkAlreadyExists,
        PutChunkResult::ChunkIndexTooHigh => ChunkIndexTooHigh,
        PutChunkResult::ChunkSizeMismatch(_) => ChunkSizeMismatch,
        PutChunkResult::HashMismatch(hm) => {
            // When there is a hash mismatch, the file has already been removed from the list of
            // pending files, so we now need to update the status and tell the index canister to
            // remove the file reference.
            status = Some(FileStatusInternal::Rejected(RejectedReason::HashMismatch));

            // We only need to remove the file reference from the index canister if this file
            // consists of multiple chunks. If the file is a single chunk then the Success case of
            // this match statement will never have been reached so the file reference will not have
            // been added to the index canister.
            if hm.chunk_count > 1 {
                state.data.push_event_to_index(EventToSync::FileRemoved(FileRemoved {
                    file_id,
                    meta_data: hm.meta_data,
                }));
            }

            HashMismatch
        }
    };

    if let Some(status) = status {
        state.data.users.set_file_status(user_id, user, file_id, status);
    }

    response
}
