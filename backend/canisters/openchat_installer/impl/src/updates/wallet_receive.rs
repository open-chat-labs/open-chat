use canister_tracing_macros::trace;
use ic_cdk::update;
use utils::cycles::accept_cycles;

#[update]
#[trace]
fn wallet_receive() {
    accept_cycles();
}
