use crate::updates::c2c_push_notification_impl;
use crate::RUNTIME_STATE;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::c2c_push_added_to_group_notification::{Response::*, *};
use types::Notification;

#[update]
#[trace]
fn c2c_push_added_to_group_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| {
        c2c_push_notification_impl(
            args.recipients,
            Notification::AddedToGroupNotification(args.notification),
            state.borrow_mut().as_mut().unwrap(),
        )
    });
    Success
}
