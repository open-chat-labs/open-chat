use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::add_webrtc_session_details::*;

#[update]
fn add_webrtc_endpoint(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| add_webrtc_endpoint_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn add_webrtc_endpoint_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let from_user_id = args.session_details.user_id();

    if !runtime_state.data.direct_chats.exists(from_user_id) {
        ic_cdk::trap("Not authorized to add webrtc session details");
    }

    if runtime_state.data.blocked_users.contains(&from_user_id) {
        return Response::Blocked;
    }

    runtime_state
        .data
        .webrtc_session_details_map
        .add(args.session_details, runtime_state.env.now());

    Response::Success
}
