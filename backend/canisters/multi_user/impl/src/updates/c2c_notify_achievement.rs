use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_achievement::*;

#[update(msgpack = true)]
#[trace]
fn c2c_notify_achievement(_args: Args) -> Response {
    unimplemented!()
}
