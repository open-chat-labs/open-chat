use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::claim_daily_chit::*;

#[update(msgpack = true)]
#[trace]
fn claim_daily_chit(_args: Args) -> Response {
    unimplemented!()
}
