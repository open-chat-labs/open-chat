use crate::RuntimeState;
use local_user_index_canister::UserIndexEvent;
use types::OCResult;
use user_index_canister::set_media_scan_config::Args;

// Arms the media hash-scanning pipeline on every local user index. Behind dual authorization
// (propose_protected_action + confirm_protected_action by two different platform operators)
// for the same reason as the OpenAI API key: enabling it arms legal-duty machinery whose
// consequences cannot be unwound by disabling it again.
pub(crate) fn execute(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.media_scan_config = args.config.clone();

    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetMediaScanConfig(args.config), None);

    Ok(())
}
