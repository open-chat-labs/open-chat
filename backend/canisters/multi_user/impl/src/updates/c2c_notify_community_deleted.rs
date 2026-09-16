use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_community_deleted::*;

#[update(msgpack = true)]
#[trace]
fn c2c_notify_community_deleted(_args: Args) -> Response {
    unimplemented!()
}
