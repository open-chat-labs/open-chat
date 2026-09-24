use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::record_user_id_migrated::*;

// Records a migration as the UserIndex will once it migrates users itself, so that the rest of the
// flow can be tested in the meantime. Only available in test mode.
#[update(guard = "caller_is_governance_principal", msgpack = true)]
#[trace]
fn record_user_id_migrated(args: Args) -> Response {
    mutate_state(|state| record_user_id_migrated_impl(args, state)).into()
}

fn record_user_id_migrated_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if !state.data.test_mode {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if state.record_user_id_migrated(args.old_user_id, args.new_user_id, args.groups) {
        Ok(())
    } else {
        Err(OCErrorCode::NoChange.into())
    }
}
