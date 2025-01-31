use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::c2c_sync_user_index_events::{Response::*, *};
use notifications_index_canister::{NotificationsIndexEvent, UserIndexEvent};
use stable_memory_map::StableMemoryMap;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_sync_user_index_events(args: Args) -> Response {
    mutate_state(|state| c2c_sync_user_index_events_impl(args, state))
}

fn c2c_sync_user_index_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        match event {
            UserIndexEvent::UserBlocked(user_id, blocked) => {
                state.data.blocked_users.insert((blocked, user_id), ());
                state.push_event_to_notifications_canisters(NotificationsIndexEvent::UserBlocked(user_id, blocked));
            }
            UserIndexEvent::UserUnblocked(user_id, unblocked) => {
                state.data.blocked_users.remove(&(unblocked, user_id));
                state.push_event_to_notifications_canisters(NotificationsIndexEvent::UserUnblocked(user_id, unblocked));
            }
        }
    }
    Success
}
