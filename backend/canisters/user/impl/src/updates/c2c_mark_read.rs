use crate::updates::c2c_mark_read_v2::c2c_mark_read_impl;
use crate::{mutate_state, run_regular_jobs};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_mark_read::Args;
use user_canister::c2c_mark_read_v2::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_mark_read(args: Args) -> Response {
    run_regular_jobs();

    if let Some(read_up_to) = args.message_ranges.into_iter().last().map(|r| r.to) {
        let args_v2 = user_canister::c2c_mark_read_v2::Args { read_up_to };
        mutate_state(|state| c2c_mark_read_impl(args_v2, state))
    } else {
        SuccessNoChange
    }
}
