use crate::read_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;

#[update]
#[trace]
async fn start_jobs() {
    read_state(crate::jobs::start);
}
