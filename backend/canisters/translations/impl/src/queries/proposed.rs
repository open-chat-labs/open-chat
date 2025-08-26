use crate::read_state;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use translations_canister::proposed::{Response::*, *};
use user_index_canister_c2c_client::lookup_user;

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn proposed(_args: Args) -> Response {
    let (user_index_canister_id, caller) = read_state(|state| (state.data.user_index_canister_id, state.env.caller()));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_operator => (),
        Ok(_) => return NotAuthorized,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let records = read_state(|state| state.data.translations.proposed());

    Success(SuccessResponse { records })
}
