use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_local_user_index::*;

#[update(msgpack = true)]
#[trace]
fn c2c_local_user_index(_args: Args) -> Response {
    unimplemented!()
}
