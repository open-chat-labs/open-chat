use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use notifications_index_canister::c2c_user_index::{Response::*, *};
use notifications_index_canister::{NotificationsIndexEvent, UserIndexEvent};
use stable_memory_map::StableMemoryMap;
use std::cell::LazyCell;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.user_index_canister_id, event.created_at, event.idempotency_id)
        {
            match event.value {
                UserIndexEvent::UserBlocked(user_id, blocked) => {
                    state.data.blocked_users.insert((blocked, user_id), ());
                    state.push_event_to_notifications_canisters(NotificationsIndexEvent::UserBlocked(user_id, blocked), *now);
                }
                UserIndexEvent::UserUnblocked(user_id, unblocked) => {
                    state.data.blocked_users.remove(&(unblocked, user_id));
                    state.push_event_to_notifications_canisters(
                        NotificationsIndexEvent::UserUnblocked(user_id, unblocked),
                        *now,
                    );
                }
                UserIndexEvent::BotEndpointUpdated(user_id, endpoint) => {
                    state.data.bot_endpoints.insert(user_id, endpoint.clone());
                    state.push_event_to_notifications_canisters(
                        NotificationsIndexEvent::BotEndpointUpdated(user_id, endpoint.clone()),
                        *now,
                    );
                }
            }
        }
    }
    Success
}
