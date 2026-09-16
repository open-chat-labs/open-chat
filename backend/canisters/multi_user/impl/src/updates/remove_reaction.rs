use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::remove_reaction::*;

#[update(msgpack = true)]
#[trace]
fn remove_reaction(_args: Args) -> Response {
    unimplemented!()
}
