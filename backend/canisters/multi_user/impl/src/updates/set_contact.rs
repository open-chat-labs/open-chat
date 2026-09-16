use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_contact::*;

#[update(msgpack = true)]
#[trace]
fn set_contact(_args: Args) -> Response {
    unimplemented!()
}
