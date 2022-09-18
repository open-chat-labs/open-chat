use crate::{mutate_state, RuntimeState, MAX_SUBSCRIPTION_AGE};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use notifications_canister::c2c_push_notification_v2::{Response::*, *};
use types::{NotificationEnvelope, UserId};

#[update_msgpack]
#[trace]
fn c2c_push_notification_v2(args: Args) -> Response {
    mutate_state(|state| c2c_push_notification_impl(args.recipients, args.notification_bytes, state))
}

fn c2c_push_notification_impl(
    recipients: Vec<UserId>,
    notification_bytes: Vec<u8>,
    runtime_state: &mut RuntimeState,
) -> Response {
    let now = runtime_state.env.now();
    if runtime_state
        .data
        .subscriptions
        .contains_any(&recipients, MAX_SUBSCRIPTION_AGE, now)
    {
        runtime_state.data.notifications.add(NotificationEnvelope {
            recipients,
            notification_bytes,
        });
    }
    Success
}
