use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use types::UserEvent;
use user_canister::c2c_notify_user_event::{Response::*, *};

#[update_candid_and_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_notify_user_event(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_user_event_impl(args, state))
}

fn c2c_notify_user_event_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    match args.event {
        UserEvent::PhoneNumberConfirmed(_) => {
            runtime_state.data.set_user_verified();
        }
        UserEvent::StorageUpgraded(ev) => {
            runtime_state.data.set_paid_storage(ev.new_limit);
        }
    }
    Success
}
