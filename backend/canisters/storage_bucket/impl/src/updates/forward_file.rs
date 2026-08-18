use crate::guards::caller_is_known_user;
use crate::model::files::ForwardFileResult;
use crate::model::index_event_batch::EventToSync;
use crate::model::users::{FileStatusInternal, IndexSyncComplete};
use crate::{RuntimeState, check_cycles_balance, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use rand::RngExt;
use storage_bucket_canister::forward_file::{Response::*, *};
use storage_index_canister::c2c_sync_bucket::{CsamMatch, CsamMatchKind};

#[update(guard = "caller_is_known_user", candid = true, json = true, msgpack = true)]
#[trace]
fn forward_file(args: Args) -> Response {
    check_cycles_balance();

    mutate_state(|state| forward_file_impl(args, state))
}

fn forward_file_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let canister_id = state.env.canister_id();
    let file_id_seed: u128 = state.env.rng().random();

    // Forwarding content upheld as CSAM is refused and reported, exactly like re-uploading it
    if let Some(file) = state.data.files.get(&args.file_id)
        && let Some(report_index) = state.data.vault.known_csam_report_index(&file.hash)
    {
        // Report once per file id: a retry of the same refused forward is not a fresh attempt
        if state.data.vault.record_blocked_attempt(caller, args.file_id) {
            state.data.push_event_to_index(EventToSync::CsamMatch(CsamMatch {
                uploader: caller,
                file_id: args.file_id,
                hash: file.hash,
                csam_report_index: report_index,
                kind: CsamMatchKind::ForwardAttempt,
            }));
        }
        return Blocked;
    }

    // Forwarding content quarantined pending a verdict is refused and reported the same way
    if let Some(file) = state.data.files.get(&args.file_id)
        && state.data.files.is_vault_pinned(&file.hash)
    {
        if let Some(report_index) = state.data.vault.pinned_report_index(&file.hash)
            && state.data.vault.record_blocked_attempt(caller, args.file_id)
        {
            state.data.push_event_to_index(EventToSync::CsamMatch(CsamMatch {
                uploader: caller,
                file_id: args.file_id,
                hash: file.hash,
                csam_report_index: report_index,
                kind: CsamMatchKind::PendingQuarantineAttempt,
            }));
        }
        return Blocked;
    }

    let accessors = args.accessors.into_iter().collect();

    match state
        .data
        .files
        .forward(caller, args.file_id, canister_id, file_id_seed, accessors, now)
    {
        ForwardFileResult::Success(f) => {
            let user = state.data.users.get(&caller).unwrap();
            let file_id = f.file_id;
            state
                .data
                .users
                .set_file_status(caller, user, file_id, FileStatusInternal::Complete(IndexSyncComplete::No));
            state.data.push_event_to_index(EventToSync::FileAdded(f));
            crate::jobs::remove_expired_files::start_job_if_required(state);
            Success(file_id)
        }
        // TODO Add this back in once we support access tokens
        // ForwardFileResult::NotAuthorized => NotAuthorized,
        ForwardFileResult::NotFound => NotFound,
    }
}
