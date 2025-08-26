use crate::guards::caller_is_owner;
use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::cancel_p2p_swap::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn cancel_p2p_swap(args: Args) -> Response {
    match execute_update(|state| cancel_p2p_swap_impl(args, state)) {
        Ok(swap_id) => {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
            Response::Success
        }
        Err(error) => Response::Error(error),
    }
}

fn cancel_p2p_swap_impl(args: Args, state: &mut RuntimeState) -> OCResult<u32> {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();

        chat.events
            .cancel_p2p_swap(my_user_id, None, args.message_id, now)
            .map(|result| result.value)
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
