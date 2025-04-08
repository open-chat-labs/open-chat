use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::cancel_p2p_swap::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn cancel_p2p_swap(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| cancel_p2p_swap_impl(args, state)) {
        Ok(swap_id) => {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
            Success
        }
        Err(response) => Error(response),
    }
}

fn cancel_p2p_swap_impl(args: Args, state: &mut RuntimeState) -> OCResult<u32> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            if !channel.chat.members.contains(&member.user_id) {
                return Err(OCErrorCode::InitiatorNotInChat.into());
            };

            let now = state.env.now();
            channel
                .chat
                .events
                .cancel_p2p_swap(member.user_id, args.thread_root_message_index, args.message_id, now)
        } else {
            Err(OCErrorCode::ChatNotFound.into())
        }
    } else {
        Err(OCErrorCode::InitiatorNotInCommunity.into())
    }
}
