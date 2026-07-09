use crate::guards::caller_is_personhood_verifier_canister;
use crate::{PersonhoodModelLapse, RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::info;
use user_index_canister::c2c_notify_model_upgraded::{Response::*, *};

// The personhood verifier announces an embedding model upgrade: proofs issued
// against older model versions lapse at the deadline, enforced by the
// remove_lapsed_unique_person_proofs job
#[update(guard = "caller_is_personhood_verifier_canister", msgpack = true)]
#[trace]
fn c2c_notify_model_upgraded(args: Args) -> Response {
    mutate_state(|state| c2c_notify_model_upgraded_impl(args, state))
}

fn c2c_notify_model_upgraded_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.personhood_model_lapse = Some(PersonhoodModelLapse {
        new_version: args.new_version,
        lapses_at: args.previous_lapses_at,
    });
    info!(
        new_version = args.new_version,
        lapses_at = args.previous_lapses_at,
        "Personhood model upgraded; older proofs will lapse"
    );
    jobs::remove_lapsed_unique_person_proofs::restart_job(state);
    Success
}
