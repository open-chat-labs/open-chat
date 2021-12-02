use crate::updates::c2c_push_notification_impl;
use crate::RUNTIME_STATE;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::c2c_push_direct_message_notification::{Response::*, *};
use types::Notification;

#[update]
#[trace]
fn c2c_push_direct_message_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| {
        c2c_push_notification_impl(
            vec![args.recipient],
            Notification::DirectMessageNotification(args.notification),
            state.borrow_mut().as_mut().unwrap(),
        )
    });
    Success
}
