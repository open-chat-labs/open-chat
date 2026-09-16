use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_install_bot::*;

#[update(msgpack = true)]
#[trace]
fn c2c_install_bot(_args: Args) -> Response {
    unimplemented!()
}
