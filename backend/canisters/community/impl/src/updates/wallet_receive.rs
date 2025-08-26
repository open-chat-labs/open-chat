use crate::execute_update;
use canister_tracing_macros::trace;
use ic_cdk::update;
use utils::cycles::accept_cycles;

#[update]
#[trace]
fn wallet_receive() {
    execute_update(|_| accept_cycles());
}
