use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use std::collections::HashSet;
use std::iter::FromIterator;
use user_canister::remove_webrtc_endpoints::*;

#[update]
fn remove_webrtc_endpoints(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| remove_webrtc_endpoints_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_webrtc_endpoints_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let ids = HashSet::from_iter(args.ids);
    runtime_state.data.webrtc_endpoints_map.remove(&ids);
    Response::Success
}
