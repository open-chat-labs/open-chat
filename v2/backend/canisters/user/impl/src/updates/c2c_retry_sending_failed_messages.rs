use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_canister::c2c_retry_sending_failed_messages::{Response::*, *};

#[update]
#[trace]
fn c2c_retry_sending_failed_messages(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_retry_sending_failed_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_retry_sending_failed_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if caller != runtime_state.data.user_index_canister_id {
        panic!("'c2c_retry_sending_failed_messages_impl' can only be called by the user_index");
    }

    runtime_state.data.failed_messages_pending_retry.retry(&args.recipient);
    Success
}
