use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::Empty;
use user_index_canister::cancel_user_migration::{Response::*, *};

// Cancels the migration of a user in a canister of their own to a MultiUser canister, as the
// UserIndex will once it migrates users itself, so that the flow can be tested in the meantime.
// Only available in test mode.
#[update(guard = "caller_is_governance_principal", msgpack = true)]
#[trace]
async fn cancel_user_migration(args: Args) -> Response {
    let (test_mode, is_single_user) = read_state(|state| {
        (
            state.data.test_mode,
            state.data.users.get_by_user_id(&args.user_id).is_some() && args.user_id.is_canister(),
        )
    });
    if !test_mode {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }
    if !is_single_user {
        return Error(OCErrorCode::TargetUserNotFound.into());
    }

    match user_canister_c2c_client::c2c_cancel_migration(args.user_id.canister_id(), &Empty {}).await {
        Ok(user_canister::c2c_cancel_migration::Response::Success) => Success,
        Ok(user_canister::c2c_cancel_migration::Response::Error(error)) => Error(error),
        Err(error) => Error(error.into()),
    }
}
