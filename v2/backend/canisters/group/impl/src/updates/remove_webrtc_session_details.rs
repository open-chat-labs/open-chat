use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::remove_webrtc_session_details::*;
use ic_cdk_macros::update;
use std::collections::HashSet;
use std::iter::FromIterator;

#[update]
fn remove_webrtc_endpoints(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| remove_webrtc_endpoints_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_webrtc_endpoints_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(participant) = runtime_state.data.participants.get_by_principal_mut(&caller) {
        let ids = HashSet::from_iter(args.ids);
        participant.webrtc_session_details_map.remove(&ids);
    }

    Response::Success
}
