use crate::execute_update_even_if_frozen;
use canister_tracing_macros::trace;
use ic_cdk::update;
use utils::cycles::accept_cycles;

#[update]
#[trace]
fn wallet_receive() {
    // A frozen canister must still be able to be topped up
    execute_update_even_if_frozen(|_| accept_cycles());
}
