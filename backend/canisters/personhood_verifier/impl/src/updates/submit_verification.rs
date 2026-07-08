use crate::model::sessions::SessionStatus;
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use personhood_verifier_canister::submit_verification::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn submit_verification(args: Args) -> Response {
    mutate_state(|state| submit_verification_impl(args, state))
}

fn submit_verification_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();

    let Some(session) = state.data.sessions.get_mut(args.session_id) else {
        return SessionNotFound;
    };
    if session.principal != caller || !matches!(session.status, SessionStatus::Open) {
        return SessionNotFound;
    }
    if session.deadline <= now {
        return SessionExpired;
    }
    let missing_steps = session.missing_steps();
    if !missing_steps.is_empty() {
        return IncompleteChallenge { missing_steps };
    }

    session.status = SessionStatus::Queued;
    state.data.processing_queue.push_back(args.session_id);
    jobs::process_verifications::start_job_if_required(state);
    Accepted
}
