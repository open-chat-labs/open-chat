use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::join_video_call::*;

#[update(msgpack = true)]
#[trace]
fn join_video_call(_args: Args) -> Response {
    unimplemented!()
}
