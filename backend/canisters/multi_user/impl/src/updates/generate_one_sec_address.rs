use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::generate_one_sec_address::*;

#[update(msgpack = true)]
#[trace]
async fn generate_one_sec_address(_args: Args) -> Response {
    unimplemented!()
}
