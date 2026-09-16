use canister_tracing_macros::trace;
use ic_cdk::update;
use user_canister::start_video_call_v2::*;

#[update]
#[trace]
fn start_video_call_v2(_args: Args) -> Response {
    unimplemented!()
}
