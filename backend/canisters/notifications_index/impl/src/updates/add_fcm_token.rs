use crate::mutate_state;
use crate::updates::{LookupError, get_user_id};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::add_fcm_token::{Args, Response};
use oc_error_codes::OCErrorCode;
use types::UnitResult;

#[update(msgpack = true)]
#[trace]
async fn add_fcm_token(args: Args) -> Response {
    match get_user_id().await {
        Ok(user_id) => mutate_state(|state| {
            Response(
                state
                    .add_fcm_token(user_id, args.fcm_token)
                    .map(|_| UnitResult::Success)
                    .unwrap_or_else(|_| UnitResult::Error(OCErrorCode::AlreadyAdded.into())),
            )
        }),
        Err(LookupError::UserNotFound) => Response(UnitResult::Error(OCErrorCode::InitiatorNotFound.into())),
        Err(LookupError::InternalError(_err)) => {
            // TODO log/trace internal error
            Response(UnitResult::Error(OCErrorCode::C2CError.into()))
        }
    }
}
