/// ! This file is now deprecated and will be removed in the future in favour
/// ! of notifications.rs!
use crate::guards::caller_is_notification_pusher;
use crate::read_state;
use ic_cdk::query;
use local_user_index_canister::notifications;
use local_user_index_canister::notifications_v2;

#[query(guard = "caller_is_notification_pusher")]
fn notifications_v2(args: notifications::Args) -> notifications_v2::Response {
    read_state(|state| crate::queries::notifications::notifications_impl(args, state).into())
}
