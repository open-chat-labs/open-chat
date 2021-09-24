use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::add_webrtc_session_details::*;
use ic_cdk_macros::update;

#[update]
fn add_webrtc_session_details(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| add_webrtc_session_details_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn add_webrtc_session_details_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    let calling_participant = match runtime_state.data.participants.get_by_principal(&caller) {
        Some(participant) => participant,
        None => ic_cdk::trap("Not authorized to add webrtc session details"),
    };

    if runtime_state.data.participants.is_blocked(&calling_participant.user_id) {
        return Response::Blocked;
    }

    for session_details in args.session_details {
        if let Some(participant) = runtime_state.data.participants.get_by_user_id_mut(&session_details.user_id()) {
            participant.webrtc_session_details_map.add(session_details, now);
        }
    }

    Response::Success
}
