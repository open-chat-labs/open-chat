use crate::mutate_state;
use crate::updates::get_user_id;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::add_fcm_token::{Args, Response};
use types::UnitResult;

#[update(msgpack = true)]
#[trace]
async fn add_fcm_token(args: Args) -> Response {
    match get_user_id().await {
        Ok(user_id) => mutate_state(|state| {
            // Registration is last-login-wins: a token held by a previous
            // account on the same device is re-assigned to the caller, and
            // re-registering an owned token is a no-op — both are Success.
            state.add_fcm_token(user_id, args.fcm_token);
            UnitResult::Success
        }),
        Err(err) => UnitResult::Error(err),
    }
}
