use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::accept_p2p_swap::*;

#[update(msgpack = true)]
#[trace]
async fn accept_p2p_swap(_args: Args) -> Response {
    unimplemented!()
}
