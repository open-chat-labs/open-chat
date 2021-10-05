use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use std::collections::HashSet;
use user_canister::remove_webrtc_session_details::*;

#[update]
fn remove_webrtc_session_details(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| remove_webrtc_session_details_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_webrtc_session_details_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let ids: HashSet<_> = args.ids.into_iter().collect();

    for chat in runtime_state.data.direct_chats.get_all_mut() {
        if let Some(event) = &chat.webrtc_session_details {
            if ids.contains(event.session_details.id()) {
                chat.webrtc_session_details = None;
            }
        }
    }

    Response::Success
}
