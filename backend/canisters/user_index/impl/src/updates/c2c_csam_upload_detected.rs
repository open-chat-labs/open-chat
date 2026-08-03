use crate::guards::caller_is_storage_index;
use crate::model::moderation;
use crate::model::reported_messages::build_upload_sanction_message_to_uploader;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::warn;
use user_index_canister::c2c_csam_upload_detected::*;

// A storage bucket refused an attempt to upload or forward content whose hash matches a
// previous UpheldAsCsam verdict: a KNOWING attempt to post confirmed CSAM. No message exists
// (the attempt was blocked at the bucket); the uploader receives the same sanction as the
// original sender, and the internal moderation channel gets the alarm.
//
// Deliberately NOT handled here: existing pre-verdict copies of the content. Every reported
// copy gets its own human verdict, and the denylist only gates FUTURE uploads - a verdict on
// one report is never applied retrospectively to messages that have already been reviewed
// (or are still awaiting review).
#[update(guard = "caller_is_storage_index", msgpack = true)]
#[trace]
fn c2c_csam_upload_detected(args: Args) -> Response {
    mutate_state(|state| c2c_csam_upload_detected_impl(args, state));
    Response::Success
}

fn c2c_csam_upload_detected_impl(args: Args, state: &mut RuntimeState) {
    let now = state.env.now();

    for m in args.matches {
        let uploader = state
            .data
            .users
            .get_by_principal(&m.uploader)
            .map(|u| (u.user_id, u.username.clone()));

        warn!(
            uploader = %m.uploader,
            file_id = %m.file_id,
            csam_report_index = m.csam_report_index,
            kind = ?m.kind,
            "Attempt to post known CSAM content"
        );

        let action = match m.kind {
            CsamMatchKind::UploadAttempt => "upload",
            CsamMatchKind::ForwardAttempt => "forward",
            // The inert default for events which predate the kind field: treat conservatively
            // (no way to know it was a knowing post-verdict act, so no sanction)
            CsamMatchKind::ExistingCopy => continue,
        };

        if let Some((user_id, _)) = &uploader {
            moderation::suspend_sender(*user_id, now, state);
            // No message means no report to resolve, but this is still a solely automated
            // decision: record it so the user can require human review (Article 22) and so an
            // unrelated report's dismissal cannot lift it
            state
                .data
                .users
                .record_csam_upload_sanction(*user_id, m.csam_report_index, now);
            state.push_event_to_local_user_index(*user_id, build_upload_sanction_message_to_uploader(*user_id));
        }

        let who = match &uploader {
            Some((user_id, username)) => format!("@{username} ({user_id})"),
            None => format!("an unrecognised principal ({})", m.uploader),
        };
        let suspended = if uploader.is_some() {
            "The user has been suspended indefinitely; if this sanction was applied in error, unsuspending the user reverses it. \
             They have been told why, and that they can request human review."
        } else {
            "The user could not be resolved, so NO suspension was applied."
        };
        let text = format!(
            "🚨 Attempt to post known CSAM content\n\n\
             {who} tried to {action} content upheld as CSAM in report #{}. \
             The attempt was blocked and no message was created. {suspended}",
            m.csam_report_index
        );
        moderation::post_moderation_notice(text, state);
    }
}
