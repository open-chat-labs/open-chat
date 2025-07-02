use crate::execute_update;
use crate::updates::set_video_call_presence::set_video_call_presence_impl;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::join_video_call::{Args, Response};

#[update(candid = true, msgpack = true)]
#[trace]
fn join_video_call(args: Args) -> Response {
    execute_update(|state| set_video_call_presence_impl(args.into(), state).into())
}
