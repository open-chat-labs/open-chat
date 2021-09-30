use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use types::webrtc::SessionDetailsEvent;
use user_canister::add_webrtc_session_details::*;

#[update]
fn add_webrtc_session_details(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| add_webrtc_session_details_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn add_webrtc_session_details_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let from_user_id = args.session_details.user_id();

    if runtime_state.data.blocked_users.contains(&from_user_id) {
        return Response::Blocked;
    }

    let chat = match runtime_state.data.direct_chats.get_mut(&from_user_id.into()) {
        Some(c) => c,
        None => return Response::UserNotFound,
    };

    chat.webrtc_session_details = Some(SessionDetailsEvent {
        session_details: args.session_details,
        timestamp: runtime_state.env.now(),
    });

    Response::Success
}
