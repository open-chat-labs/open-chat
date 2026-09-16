use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::SwapStatusChange as Args;

#[update(msgpack = true)]
#[trace]
fn c2c_notify_p2p_swap_status_change(_args: Args) {
    unimplemented!()
}
