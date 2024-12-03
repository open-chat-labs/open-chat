use crate::updates::set_video_call_presence::set_video_call_presence_impl;
use crate::{mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::join_video_call::{Args, Response};

#[update(msgpack = true)]
#[trace]
fn join_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_video_call_presence_impl(args.into(), state))
}
