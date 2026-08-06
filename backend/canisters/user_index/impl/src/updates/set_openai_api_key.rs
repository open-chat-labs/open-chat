use crate::RuntimeState;
use local_user_index_canister::{SetOpenAIApiKey, UserIndexEvent};
use types::OCResult;
use user_index_canister::set_openai_api_key::Args;

// The detection "danger switch": setting the key arms the classification pipeline on every
// local user index. Behind dual authorization (#9136) - reachable only via
// propose_protected_action + confirm_protected_action by two different platform operators -
// because activation triggers legal-duty machinery whose consequences cannot be unwound by
// unsetting the key again.
pub(crate) fn execute(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.openai_api_key = args.api_key.clone();

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::SetOpenAIApiKey(SetOpenAIApiKey { api_key: args.api_key }),
        None,
    );

    Ok(())
}
