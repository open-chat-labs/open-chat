use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_pin_number::*;

#[update(msgpack = true)]
#[trace]
async fn set_pin_number(_args: Args) -> Response {
    unimplemented!()
}
