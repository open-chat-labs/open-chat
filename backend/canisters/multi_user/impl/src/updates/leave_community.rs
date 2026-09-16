use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::leave_community::*;

#[update(msgpack = true)]
#[trace]
async fn leave_community(_args: Args) -> Response {
    unimplemented!()
}
