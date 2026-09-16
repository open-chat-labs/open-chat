use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_remove_from_community::*;

#[update(msgpack = true)]
#[trace]
fn c2c_remove_from_community(_args: Args) -> Response {
    unimplemented!()
}
