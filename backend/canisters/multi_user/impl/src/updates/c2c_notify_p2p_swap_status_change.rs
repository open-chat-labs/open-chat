use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::SwapStatusChange as Args;

// TODO: When implementing this, guard it with `caller_is_escrow_canister` and ignore a notification
// unless its `swap_id` matches the swap on the message it names, as the User canister does, since
// anyone can create a swap in the escrow canister naming any message
#[update(msgpack = true)]
#[trace]
fn c2c_notify_p2p_swap_status_change(_args: Args) {
    unimplemented!()
}
