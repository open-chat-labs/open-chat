use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::add_reaction::*;

#[update(msgpack = true)]
#[trace]
fn add_reaction(_args: Args) -> Response {
    unimplemented!()
}
