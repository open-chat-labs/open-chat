use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::create_group::*;

#[update(msgpack = true)]
#[trace]
async fn create_group(_args: Args) -> Response {
    unimplemented!()
}
