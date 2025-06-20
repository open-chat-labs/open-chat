use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::cancel_p2p_swap::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn cancel_p2p_swap(args: Args) -> Response {
    match execute_update(|state| cancel_p2p_swap_impl(args, state)) {
        Ok(swap_id) => {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
            Response::Success
        }
        Err(response) => Response::Error(response),
    }
}

fn cancel_p2p_swap_impl(args: Args, state: &mut RuntimeState) -> OCResult<u32> {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();
    state
        .data
        .chat
        .events
        .cancel_p2p_swap(user_id, args.thread_root_message_index, args.message_id, now)
        .map(|result| {
            state.push_bot_notification(result.bot_notification);
            result.value
        })
}
