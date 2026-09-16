use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::unblock_user::*;

#[update(msgpack = true)]
#[trace]
fn unblock_user(_args: Args) -> Response {
    unimplemented!()
}
