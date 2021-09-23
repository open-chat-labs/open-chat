use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::add_webrtc_answer::*;

#[update]
fn add_webrtc_answer(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| add_webrtc_answer_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn add_webrtc_answer_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.webrtc_connection_details_map.add_answer(
        args.id,
        args.offer_id,
        args.from,
        args.connection_string,
        args.ice_candidates,
        runtime_state.env.now(),
    );

    Response::Success
}
