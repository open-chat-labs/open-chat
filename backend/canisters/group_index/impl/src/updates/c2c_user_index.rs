use crate::guards::caller_is_user_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use group_index_canister::UserIndexEvent;
use group_index_canister::c2c_user_index::{Response::*, *};
use local_user_index_canister::GroupIndexEvent;
use std::cell::LazyCell;
use types::TimestampMillis;

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
            handle_event(event.value, &now, state);
        }
    }
    Success
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    event: UserIndexEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        UserIndexEvent::NotifyOfUserDeleted(canister_id, user_id) => {
            if let Some(index) = state
                .data
                .local_index_map
                .get_index_canister_for_group(&canister_id.into())
                .or_else(|| {
                    state
                        .data
                        .local_index_map
                        .get_index_canister_for_community(&canister_id.into())
                })
            {
                state.push_event_to_local_index(index, GroupIndexEvent::NotifyOfUserDeleted(canister_id, user_id), **now);
            }
        }
    }
}
