use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_group_canister::*;

#[update(msgpack = true)]
#[trace]
fn c2c_group_canister(_args: Args) -> Response {
    unimplemented!()
}
