use canister_api_macros::trace;
use cycles_utils::accept_cycles;
use ic_cdk_macros::update;

#[update]
#[trace]
fn wallet_receive() {
    accept_cycles();
}
