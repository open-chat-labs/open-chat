use crate::guards::caller_is_owner;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::{Payer, deposit_to_accept_p2p_swap};
use types::{AcceptSwapSuccess, Achievement, CanisterId, OCResult, P2PSwapStatus, TimestampMillis, UserId};
use user_canister::accept_p2p_swap::{Response::*, *};
use user_canister::{P2PSwapStatusChange, UserCanisterEvent};
use user_core::updates::accept_p2p_swap::{Reserved, deposit_failed, deposited, prepare};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn accept_p2p_swap(args: Args) -> Response {
    execute_update_async(|| accept_p2p_swap_impl(args)).await
}

async fn accept_p2p_swap_impl(mut args: Args) -> Response {
    let PrepareResult {
        my_user_id,
        escrow_canister_id,
        reserved,
        now,
    } = match mutate_state(|state| prepare_impl(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let content = &reserved.reserve_success.content;
    // The user's funds are in this canister's own account, unless they are paying from an
    // external account they approved
    let payer = match args.from_account {
        Some(from) => Payer::Approved {
            from,
            spender_subaccount: None,
        },
        None => Payer::ThisCanister,
    };
    let transfer_result = deposit_to_accept_p2p_swap(
        escrow_canister_id,
        my_user_id.as_principal(),
        content.swap_id,
        &content.token1,
        content.token1_amount,
        now,
        payer,
    )
    .await;

    match transfer_result {
        Ok(index) => {
            let swap_id = content.swap_id;
            mutate_state(|state| {
                let now = state.env.now();
                if let Some(accepted) = deposited(&mut state.data.user, my_user_id, &args, reserved.reserve_success, index, now)
                {
                    state.push_user_canister_event(
                        args.user_id,
                        UserCanisterEvent::P2PSwapStatusChange(Box::new(P2PSwapStatusChange {
                            thread_root_message_id: reserved.thread_root_message_id,
                            message_id: args.message_id,
                            status: P2PSwapStatus::Accepted(accepted),
                        })),
                    );
                    state.award_achievement_and_notify(Achievement::AcceptedP2PSwapOffer, now);
                }
            });
            NotifyEscrowCanisterOfDepositJob::run(swap_id);
            Success(AcceptSwapSuccess { token1_txn_in: index })
        }
        Err(error) => {
            mutate_state(|state| deposit_failed(&mut state.data.user, my_user_id, &args, state.env.now()));
            Error(error)
        }
    }
}

struct PrepareResult {
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    reserved: Reserved,
    now: TimestampMillis,
}

fn prepare_impl(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareResult> {
    let canister_id = state.env.canister_id();
    let my_user_id = canister_id.into();
    let now = state.env.now();
    // A user alone in their canister holds their funds in its account, which escrow knows them by
    let reserved = prepare(&mut state.data.user, my_user_id, canister_id, canister_id, args, now)?;

    Ok(PrepareResult {
        my_user_id,
        escrow_canister_id: state.data.escrow_canister_id,
        reserved,
        now,
    })
}
