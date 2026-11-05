use crate::mutate_state;
use crate::updates::get_user_id;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::remove_apns_device::{Args, Response};
use types::UnitResult;

/// Removes the caller's iOS device on sign-out, with both of its tokens. Idempotent: a device
/// that is already gone, or now belongs to another account, still results in Success.
#[update(msgpack = true)]
#[trace]
async fn remove_apns_device(args: Args) -> Response {
    match get_user_id().await {
        Ok(user_id) => mutate_state(|state| {
            state.remove_apns_device(user_id, args.device);
            UnitResult::Success
        }),
        Err(err) => UnitResult::Error(err),
    }
}
