use crate::guards::caller_is_notification_pusher;
use crate::{RuntimeState, read_state};
use ic_cdk::query;
use local_user_index_canister::latest_notification_index::{Response::*, *};

#[query(guard = "caller_is_notification_pusher")]
fn latest_notification_index(_args: Args) -> Response {
    read_state(latest_notification_index_impl)
}

fn latest_notification_index_impl(state: &RuntimeState) -> Response {
    Success(state.data.notifications.latest_event_index())
}
