use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_group_index;
use crate::model::events::CommunityEventInternal;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_local_group_index::*;
use community_canister::LocalGroupIndexEvent;
use constants::OPENCHAT_BOT_USER_ID;
use types::{GroupNameChanged, Timestamped};

#[update(guard = "caller_is_local_group_index", msgpack = true)]
#[trace]
fn c2c_local_group_index(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_local_group_index_impl(args, state))
}

fn c2c_local_group_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state.data.idempotency_checker.check(
            state.data.local_group_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            process_event(event.value, state);
        }
    }
    Response::Success
}

fn process_event(event: LocalGroupIndexEvent, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        LocalGroupIndexEvent::NameChanged(ev) => {
            state.data.events.push_event(
                CommunityEventInternal::NameChanged(Box::new(GroupNameChanged {
                    new_name: ev.name.clone(),
                    previous_name: state.data.name.value.clone(),
                    changed_by: OPENCHAT_BOT_USER_ID,
                })),
                now,
            );

            state.data.name = Timestamped::new(ev.name, now);
        }
        LocalGroupIndexEvent::VerifiedChanged(ev) => {
            state.data.verified = Timestamped::new(ev.verified, now);
        }
    }

    handle_activity_notification(state);
}
