use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_community_indexes::*;

#[update(msgpack = true)]
#[trace]
fn set_community_indexes(_args: Args) -> Response {
    unimplemented!()
}
