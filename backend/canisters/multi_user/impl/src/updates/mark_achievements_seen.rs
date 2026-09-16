use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_achievements_seen::*;

#[update(msgpack = true)]
#[trace]
fn mark_achievements_seen(_args: Args) -> Response {
    unimplemented!()
}
