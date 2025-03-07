use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_group_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use constants::OPENCHAT_BOT_USER_ID;
use group_canister::c2c_local_group_index::*;
use group_canister::LocalGroupIndexEvent;
use std::cell::LazyCell;
use types::{GroupNameChanged, TimestampMillis, Timestamped};

#[update(guard = "caller_is_local_group_index", msgpack = true)]
#[trace]
fn c2c_local_group_index(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_local_group_index_impl(args, state))
}

fn c2c_local_group_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state.data.idempotency_checker.check(
            state.data.local_group_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            process_event(event.value, &now, state);
        }
    }
    Response::Success
}

fn process_event<F: FnOnce() -> TimestampMillis>(
    event: LocalGroupIndexEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        LocalGroupIndexEvent::NameChanged(ev) => {
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
        LocalGroupIndexEvent::VerifiedChanged(ev) => {
            state.data.verified = Timestamped::new(ev.verified, **now);
        }
    }

    handle_activity_notification(state);
}
