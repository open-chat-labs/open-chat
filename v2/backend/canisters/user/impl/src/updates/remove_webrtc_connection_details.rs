use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use std::collections::HashSet;
use user_canister::remove_webrtc_connection_details::*;

#[update]
fn remove_webrtc_connection_details(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| remove_webrtc_connection_details_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_webrtc_connection_details_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_ids: HashSet<_> = args.ids.into_iter().collect();
    runtime_state
        .data
        .webrtc_connection_details_map
        .remove_connection_details(&user_ids);
    Response::Success
}
