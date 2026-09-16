use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_profile_background::*;

#[update(msgpack = true)]
#[trace]
fn set_profile_background(_args: Args) -> Response {
    unimplemented!()
}
