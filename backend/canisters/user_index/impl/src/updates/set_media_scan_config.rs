use crate::RuntimeState;
use local_user_index_canister::UserIndexEvent;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::set_media_scan_config::Args;

// Arms the media hash-scanning pipeline on every local user index. Behind dual authorization
// (propose_protected_action + confirm_protected_action by two different platform operators)
// for the same reason as the OpenAI API key: enabling it arms legal-duty machinery whose
// consequences cannot be unwound by disabling it again.
pub(crate) fn execute(args: Args, state: &mut RuntimeState) -> OCResult {
    // Scanning must not be armed while the internal moderation channel is unset: detections
    // would still sanction and record reports, but the alert cards for human review - and the
    // stalled-pipeline notices - would all be dropped on the floor. Configure the channel
    // first.
    if args.config.enabled && state.data.internal_moderation_channel.is_none() {
        return Err(OCErrorCode::NotInitialized.with_message("internal moderation channel is not configured"));
    }

    state.data.media_scan_config = args.config.clone();

    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetMediaScanConfig(args.config), None);

    Ok(())
}
