use canister_api_macros::trace;
use ic_cdk_macros::update;
use utils::cycles::accept_cycles;

#[update]
#[trace]
fn wallet_receive() {
    accept_cycles();
}
