use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use constants::OPENCHAT_BOT_USER_ID;
use group_canister::LocalIndexEvent;
use group_canister::c2c_local_index::*;
use std::cell::LazyCell;
use types::{GroupNameChanged, TimestampMillis, Timestamped};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_index(args: Args) -> Response {
    execute_update(|state| c2c_local_index_impl(args, state))
}

fn c2c_local_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state.data.idempotency_checker.check(
            state.data.local_user_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            process_event(event.value, &now, state);
        }
    }
    Response::Success
}

fn process_event<F: FnOnce() -> TimestampMillis>(
    event: LocalIndexEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        LocalIndexEvent::NameChanged(ev) => {
            state.data.chat.events.push_main_event(
                ChatEventInternal::GroupNameChanged(Box::new(GroupNameChanged {
                    new_name: ev.name.clone(),
                    previous_name: state.data.chat.name.value.clone(),
                    changed_by: OPENCHAT_BOT_USER_ID,
                })),
                0,
                **now,
            );

            state.data.chat.name = Timestamped::new(ev.name, **now);
        }
        LocalIndexEvent::VerifiedChanged(ev) => {
            state.data.verified = Timestamped::new(ev.verified, **now);
        }
        LocalIndexEvent::UserDeleted(user_id) => {
            state.data.chat.members.remove(user_id, **now);
            state.data.remove_user(user_id, None);
        }
    }

    handle_activity_notification(state);
}
