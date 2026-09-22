use crate::crypto::deposit_to_accept_p2p_swap;
use crate::guards::caller_is_owner;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{
    AcceptSwapSuccess, Achievement, CanisterId, MessageId, OCResult, P2PSwapStatus, ReserveP2PSwapSuccess, TimestampMillis,
    UserId,
};
use user_canister::accept_p2p_swap::{Response::*, *};
use user_canister::{P2PSwapStatusChange, UserCanisterEvent};
use user_core::updates::accept_p2p_swap::{Reserved, deposit_failed, deposited};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn accept_p2p_swap(args: Args) -> Response {
    execute_update_async(|| accept_p2p_swap_impl(args)).await
}

async fn accept_p2p_swap_impl(mut args: Args) -> Response {
    let PrepareResult {
        my_user_id,
        escrow_canister_id,
        reserve_success,
        thread_root_message_id,
        now,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(response) => return Error(response),
    };

    let content = &reserve_success.content;
    let swap_id = content.swap_id;
    let transfer_result = deposit_to_accept_p2p_swap(
        escrow_canister_id,
        my_user_id,
        swap_id,
        &content.token1,
        content.token1_amount,
        now,
        args.from_account,
    )
    .await;

    match transfer_result {
        Ok(index) => {
            mutate_state(|state| {
                let now = state.env.now();
                if let Some(accepted) = deposited(&mut state.data.user, my_user_id, &args, reserve_success, index, now) {
                    state.push_user_canister_event(
                        args.user_id,
                        UserCanisterEvent::P2PSwapStatusChange(Box::new(P2PSwapStatusChange {
                            thread_root_message_id,
                            message_id: args.message_id,
                            status: P2PSwapStatus::Accepted(accepted),
                        })),
                    );
                    state.award_achievement_and_notify(Achievement::AcceptedP2PSwapOffer, now);
                }
            });
            NotifyEscrowCanisterOfDepositJob::run(swap_id, my_user_id);
            Success(AcceptSwapSuccess { token1_txn_in: index })
        }
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                deposit_failed(&mut state.data.user, my_user_id, &args, now);
            });
            Error(error)
        }
    }
}

struct PrepareResult {
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    reserve_success: ReserveP2PSwapSuccess,
    thread_root_message_id: Option<MessageId>,
    now: TimestampMillis,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareResult> {
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    let Reserved {
        reserve_success,
        thread_root_message_id,
    } = user_core::updates::accept_p2p_swap::prepare(&mut state.data.user, my_user_id, args, now)?;
    Ok(PrepareResult {
        my_user_id,
        escrow_canister_id: state.data.escrow_canister_id,
        reserve_success,
        thread_root_message_id,
        now,
    })
}
