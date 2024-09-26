use crate::guards::caller_is_owner;
use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::CancelP2PSwapResult;
use user_canister::cancel_p2p_swap::{Response::*, *};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
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
    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        match chat.events.cancel_p2p_swap(my_user_id, None, args.message_id, now) {
            CancelP2PSwapResult::Success(swap_id) => Ok(swap_id),
            CancelP2PSwapResult::Failure(status) => Err(Box::new(StatusError(status.into()))),
            CancelP2PSwapResult::SwapNotFound => Err(Box::new(SwapNotFound)),
        }
    } else {
        Err(Box::new(ChatNotFound))
    }
}
