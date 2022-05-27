use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_toggle_mute_notifications::{Response::*, *};

#[update_candid_and_msgpack]
#[trace]
fn c2c_toggle_mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_toggle_mute_notifications_impl(args, state))
}

fn c2c_toggle_mute_notifications_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    match runtime_state.data.participants.get_by_user_id_mut(&user_id) {
        Some(participant) => {
            participant.notifications_muted = args.mute;
            Success
        }
        None => CallerNotInGroup,
    }
}
