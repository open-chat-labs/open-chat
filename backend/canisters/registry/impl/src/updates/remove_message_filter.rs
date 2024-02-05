use crate::{mutate_state, read_state};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use registry_canister::remove_message_filter::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn remove_message_filter(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_moderator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    }

    mutate_state(|state| match state.data.message_filters.remove(args.id, state.env.now()) {
        true => Success,
        false => NotFound,
    })
}
