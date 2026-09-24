use crate::{execute_update, read_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use utils::cycles::accept_cycles;

#[update]
#[trace]
fn wallet_receive() {
    // A frozen canister must still be able to be topped up, but without running the regular jobs,
    // which would change its state
    if read_state(|state| state.data.is_frozen()) {
        accept_cycles();
    } else {
        execute_update(|_| accept_cycles());
    }
}
