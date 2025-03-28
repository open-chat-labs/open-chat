use crate::mutate_state;
use crate::updates::c2c_push_notifications::{push_user_notification, verify_caller};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_canister::c2c_push_notification::*;

#[update(msgpack = true)]
#[trace]
async fn c2c_push_notification(args: Args) -> Response {
    if let Err(response) = verify_caller(args.authorizer).await {
        return response;
    }

    mutate_state(|state| {
        push_user_notification(
            args.sender,
            args.recipients,
            args.notification_bytes,
            state.env.now(),
            &mut state.data,
        )
    });
    Response::Success
}
