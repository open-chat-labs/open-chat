use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_set_user_suspended::*;

#[update(msgpack = true)]
#[trace]
fn c2c_set_user_suspended(_args: Args) -> Response {
    unimplemented!()
}
