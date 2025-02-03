use crate::{model::translations::RejectResponse, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use translations_canister::reject::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update(candid = true, msgpack = true)]
#[trace]
async fn reject(args: Args) -> Response {
    let (user_index_canister_id, caller, now) =
        read_state(|state| (state.data.user_index_canister_id, state.env.caller(), state.env.now()));

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => user.user_id,
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    mutate_state(
        |state| match state.data.translations.reject(args.id, args.reason, user_id, now) {
            RejectResponse::Success => Success,
            RejectResponse::NotProposed => NotProposed,
            RejectResponse::NotFound => NotFound,
        },
    )
}
