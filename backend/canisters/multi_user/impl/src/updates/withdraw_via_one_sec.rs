use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::withdraw_via_one_sec::*;

#[update(msgpack = true)]
#[trace]
async fn withdraw_via_one_sec(_args: Args) -> Response {
    unimplemented!()
}
