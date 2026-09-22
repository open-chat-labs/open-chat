use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::updates::c2c_user_canister_v2::send_p2p_swap_status_change;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{
    AcceptSwapSuccess, Achievement, CanisterId, MessageId, OCResult, P2PSwapStatus, ReserveP2PSwapSuccess, TimestampMillis,
    UserId,
};
use user_canister::P2PSwapStatusChange;
use user_canister::accept_p2p_swap::{Response::*, *};
use user_core::updates::accept_p2p_swap::{Reserved, deposit_failed, deposited};

// As in the User canister, the swap is reserved for the user, their deposit of token1 is made into
// the escrow canister from their account (one of this canister's subaccounts) or the one they
// approved, and the escrow canister is told of it
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn accept_p2p_swap(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
        my_user_id,
        escrow_canister_id,
        reserve_success,
        thread_root_message_id,
        now,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let content = &reserve_success.content;
    let swap_id = content.swap_id;
    let transfer_result = ledger_utils::deposit_to_accept_p2p_swap(
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
            let accepted = mutate_state(|state| {
                let now = state.env.now();
                state.data.users.with_user_mut(my_index, |user| {
                    deposited(user, my_user_id, &args, reserve_success, index, now)
                })
            });
            // Told even if the user was deleted meanwhile, so that the swap still completes and
            // pays their account
            NotifyEscrowCanisterOfDepositJob::run(my_index, swap_id, my_user_id);
            match accepted {
                Some(Some(accepted)) => mutate_state(|state| {
                    let now = state.env.now();
                    send_p2p_swap_status_change(
                        my_index,
                        args.user_id,
                        P2PSwapStatusChange {
                            thread_root_message_id,
                            message_id: args.message_id,
                            status: P2PSwapStatus::Accepted(accepted),
                        },
                        state,
                    );
                    state.award_achievement_and_notify(my_index, Achievement::AcceptedP2PSwapOffer, now);
                }),
                Some(None) => {}
                None => return Error(OCErrorCode::InitiatorNotFound.into()),
            }
            Success(AcceptSwapSuccess { token1_txn_in: index })
        }
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state
                    .data
                    .users
                    .with_user_mut(my_index, |user| deposit_failed(user, my_user_id, &args, now));
            });
            Error(error)
        }
    }
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    reserve_success: ReserveP2PSwapSuccess,
    thread_root_message_id: Option<MessageId>,
    now: TimestampMillis,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let canister_id = state.env.canister_id();
    let escrow_canister_id = state.data.escrow_canister_id;
    let now = state.env.now();
    state.with_caller_user_mut(|my_index, user| {
        let my_user_id = UserId::new_indexed(canister_id, my_index);
        let Reserved {
            reserve_success,
            thread_root_message_id,
        } = user_core::updates::accept_p2p_swap::prepare(user, my_user_id, args, now)?;
        Ok(PrepareOk {
            my_index,
            my_user_id,
            escrow_canister_id,
            reserve_success,
            thread_root_message_id,
            now,
        })
    })
}
