use crate::mutate_state;
use crate::updates::get_user_id;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::add_apns_device::{Args, Response};
use oc_error_codes::OCErrorCode;
use types::UnitResult;

/// Registers the caller's iOS device. Last login wins: a device another account registered
/// with either of these tokens becomes the caller's.
#[update(msgpack = true)]
#[trace]
async fn add_apns_device(args: Args) -> Response {
    if args.device.is_empty() {
        return UnitResult::Error(OCErrorCode::InvalidRequest.into());
    }
    match get_user_id().await {
        Ok(user_id) => mutate_state(|state| {
            state.register_apns_device(user_id, args.device);
            UnitResult::Success
        }),
        Err(err) => UnitResult::Error(err),
    }
}
