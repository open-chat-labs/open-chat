use crate::read_state;
use canister_tracing_macros::trace;
use ic_cdk::query;
use translations_canister::proposed::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[query(composite = true)]
#[trace]
async fn proposed(_args: Args) -> Response {
    let (user_index_canister_id, caller) = read_state(|state| (state.data.user_index_canister_id, state.env.caller()));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    let records = read_state(|state| state.data.translations.proposed());

    Success(SuccessResponse { records })
}
