use crate::mutate_state;
use crate::updates::get_user_id;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::remove_fcm_token::{Args, Response};
use types::UnitResult;

/// Removes the caller's own FCM token, e.g. when signing out on a device so
/// that pushes for this account stop reaching it. Removal is idempotent: a
/// token that is already gone (or was re-assigned to another account in the
/// meantime) still results in Success.
#[update(msgpack = true)]
#[trace]
async fn remove_fcm_token(args: Args) -> Response {
    match get_user_id().await {
        Ok(user_id) => mutate_state(|state| {
            let _ = state.remove_fcm_token(user_id, args.fcm_token);
            UnitResult::Success
        }),
        Err(err) => UnitResult::Error(err),
    }
}
