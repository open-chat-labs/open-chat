use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use types::webrtc::EndpointEvent;
use user_canister::add_webrtc_endpoint::*;

#[update]
fn add_webrtc_endpoint(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| add_webrtc_endpoint_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn add_webrtc_endpoint_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if !runtime_state.data.direct_chats.exists(args.endpoint.user_id) {
        ic_cdk::trap("Not authorized to add webrtc endpoint");
    }

    runtime_state.data.webrtc_endpoints_map.add(EndpointEvent {
        endpoint: args.endpoint,
        timestamp: runtime_state.env.now(),
    });
    Response::Success
}
