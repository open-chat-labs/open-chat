use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use tracing::info;
use user_index_canister::wipe_legacy_unique_person_proofs::*;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn wipe_legacy_unique_person_proofs(_args: Args) -> Response {
    mutate_state(wipe_legacy_unique_person_proofs_impl)
}

fn wipe_legacy_unique_person_proofs_impl(state: &mut RuntimeState) -> Response {
    state.data.wipe_legacy_unique_person_proofs = true;
    jobs::remove_lapsed_unique_person_proofs::restart_job(state);
    info!("Legacy DecideAI unique person proof wipe triggered");
    Response::Success
}
