use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_vote_on_proposal::*;

#[update(msgpack = true)]
#[trace]
async fn c2c_vote_on_proposal(_args: Args) -> Response {
    unimplemented!()
}
