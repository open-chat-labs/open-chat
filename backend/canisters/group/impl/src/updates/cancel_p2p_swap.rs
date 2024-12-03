use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::cancel_p2p_swap::{Response::*, *};
use types::CancelP2PSwapResult;

#[update(msgpack = true)]
#[trace]
fn cancel_p2p_swap(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| cancel_p2p_swap_impl(args, state)) {
        Ok(swap_id) => {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
            Success
        }
        Err(response) => *response,
    }
}

fn cancel_p2p_swap_impl(args: Args, state: &mut RuntimeState) -> Result<u32, Box<Response>> {
    if state.data.is_frozen() {
        return Err(Box::new(ChatFrozen));
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        let now = state.env.now();
        match state
            .data
            .chat
            .events
            .cancel_p2p_swap(member.user_id(), args.thread_root_message_index, args.message_id, now)
        {
            CancelP2PSwapResult::Success(swap_id) => Ok(swap_id),
            CancelP2PSwapResult::Failure(status) => Err(Box::new(StatusError(status.into()))),
            CancelP2PSwapResult::SwapNotFound => Err(Box::new(SwapNotFound)),
        }
    } else {
        Err(Box::new(UserNotInGroup))
    }
}
