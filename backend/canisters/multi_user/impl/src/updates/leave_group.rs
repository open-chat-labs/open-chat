use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::leave_group::*;

#[update(msgpack = true)]
#[trace]
async fn leave_group(_args: Args) -> Response {
    unimplemented!()
}
