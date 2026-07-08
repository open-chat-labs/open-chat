use crate::model::sessions::SessionStatus;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use personhood_verifier_canister::verification_status::{Response::*, *};

#[query(msgpack = true)]
#[trace]
fn verification_status(args: Args) -> Response {
    read_state(|state| verification_status_impl(args, state))
}

fn verification_status_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let Some(session) = state.data.sessions.get(args.session_id) else {
        return SessionNotFound;
    };
    if session.principal != caller {
        return SessionNotFound;
    }
    match session.status {
        SessionStatus::Open => NotSubmitted,
        SessionStatus::Queued => {
            let position = state
                .data
                .processing_queue
                .iter()
                .position(|id| *id == args.session_id)
                .map_or(0, |p| p as u32 + 1);
            Queued { position }
        }
        SessionStatus::Processing => Processing,
        SessionStatus::Verified { model_version } => Verified { model_version },
        SessionStatus::RetryRequired { reason } => RetryRequired { reason },
        SessionStatus::Failed { reason } => Failed { reason },
    }
}
