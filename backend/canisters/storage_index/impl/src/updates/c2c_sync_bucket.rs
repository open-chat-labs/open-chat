use crate::RuntimeState;
use constants::ONE_GB;
use storage_index_canister::{CsamMatch, CsamMatchKind};
use types::{CanisterId, FileAdded};
use user_index_canister as ui_csam;

// A file arriving with a hash already upheld as CSAM means this bucket has not applied the denylist -
// it was uploaded before the op landed, or the op was dropped. Re-push it: the bucket then refuses to
// serve the bytes and blocks any further upload of them.
pub(crate) fn repush_denylist_if_hash_known(bucket: CanisterId, file: &FileAdded, state: &mut RuntimeState) {
    let verified = state.data.csam_hashes.get(&file.hash).map(|r| (*r, false));
    let derived = state.data.derived_csam_hashes.get(&file.hash).map(|r| (*r, true));
    if let Some((report_index, derived)) = verified.or(derived) {
        tracing::error!(%bucket, report_index, derived, "File uploaded with a denylisted hash; re-pushing the denylist");
        let now = state.env.now();
        state
            .data
            .push_denylisted_hash_to_bucket(bucket, file.hash, report_index, derived, now, state.env.rng());
    }
}

// One event per match, each reported to the UserIndex
pub(crate) fn forward_csam_matches(bucket: CanisterId, matches: Vec<CsamMatch>, state: &mut RuntimeState) {
    for m in matches {
        let csam_match = ui_csam::CsamUploadMatch {
            uploader: m.uploader,
            bucket,
            file_id: m.file_id,
            hash: m.hash,
            csam_report_index: m.csam_report_index,
            kind: match m.kind {
                CsamMatchKind::UploadAttempt => ui_csam::CsamMatchKind::UploadAttempt,
                CsamMatchKind::ForwardAttempt => ui_csam::CsamMatchKind::ForwardAttempt,
                CsamMatchKind::PendingQuarantineAttempt => ui_csam::CsamMatchKind::PendingQuarantineAttempt,
                CsamMatchKind::ExistingCopy => ui_csam::CsamMatchKind::ExistingCopy,
            },
        };
        if !state.push_event_to_user_index(user_index_canister::StorageIndexEvent::CsamUploadDetected(csam_match)) {
            // Can only happen before the user_index has ever driven a vault op; loud because
            // a dropped match means a re-upload of known CSAM content goes unreported
            tracing::error!("CSAM upload match dropped: user_index canister id not yet known");
        }
    }
}

pub(crate) fn update_bucket_figures(
    bucket: CanisterId,
    heap_memory_used: u64,
    stable_memory_used: u64,
    total_file_bytes: u64,
    state: &mut RuntimeState,
) {
    if let Some(b) = state.data.buckets.get_mut(&bucket) {
        b.heap_memory_used = heap_memory_used;
        b.stable_memory_used = stable_memory_used;
        b.total_file_bytes = total_file_bytes;
    }

    if heap_memory_used >= ONE_GB || stable_memory_used >= 40 * ONE_GB {
        state.data.buckets.set_full(bucket, true);
    }
}
