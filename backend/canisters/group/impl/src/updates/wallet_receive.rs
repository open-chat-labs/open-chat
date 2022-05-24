use crate::run_regular_jobs;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use utils::cycles::accept_cycles;

#[update]
#[trace]
fn wallet_receive() {
    run_regular_jobs();

    accept_cycles();
}
