use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::block_user::*;

#[update(msgpack = true)]
#[trace]
fn block_user(_args: Args) -> Response {
    unimplemented!()
}
