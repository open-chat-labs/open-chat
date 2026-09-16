use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::pay_for_streak_insurance::*;

#[update(msgpack = true)]
#[trace]
async fn pay_for_streak_insurance(_args: Args) -> Response {
    unimplemented!()
}
