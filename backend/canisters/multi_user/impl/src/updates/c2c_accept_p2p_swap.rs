use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_accept_p2p_swap::*;

#[update(msgpack = true)]
#[trace]
async fn c2c_accept_p2p_swap(_args: Args) -> Response {
    unimplemented!()
}
