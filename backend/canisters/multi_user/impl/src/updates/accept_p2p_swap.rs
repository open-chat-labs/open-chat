use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::updates::c2c_user_canister_v2::send_p2p_swap_status_change;
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::{Payer, deposit_to_accept_p2p_swap};
use types::{AcceptSwapSuccess, Achievement, CanisterId, OCResult, P2PSwapStatus, TimestampMillis, UserId};
use user_canister::P2PSwapStatusChange;
use user_canister::accept_p2p_swap::{Response::*, *};
use user_core::updates::accept_p2p_swap::{Reserved, deposit_failed, deposited, prepare};

// The User canister's `accept_p2p_swap`. Users hold their own funds in their own wallets, so token1
// is pulled from the user's wallet (or the account they name) via ICRC2, against an approval made
// under their own spender subaccount, and deposited into the escrow canister under their principal,
// by which it knows them.
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn accept_p2p_swap(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
        my_user_id,
        my_principal,
        escrow_canister_id,
        reserved,
        now,
    } = match mutate_state(|state| prepare_impl(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let swap_id = reserved.reserve_success.content.swap_id;
    let payer = Payer::Approved {
        from: args.from_account.unwrap_or(my_principal.into()),
        spender_subaccount: Some(ledger_utils::spender_subaccount(my_principal)),
    };
    let transfer_result = deposit_to_accept_p2p_swap(
        escrow_canister_id,
        my_principal,
        swap_id,
        &reserved.reserve_success.content.token1,
        reserved.reserve_success.content.token1_amount,
        now,
        payer,
    )
    .await;

    match transfer_result {
        Ok(index) => {
            mutate_state(|state| {
                let now = state.env.now();
                // Nothing to record if the user was deleted while the deposit was made
                let accepted = state
                    .data
                    .users
                    .with_user_mut(my_index, |user| {
                        deposited(user, my_user_id, &args, reserved.reserve_success, index, now)
                    })
                    .flatten();
                if let Some(accepted) = accepted {
                    send_p2p_swap_status_change(
                        my_index,
                        args.user_id,
                        P2PSwapStatusChange {
                            thread_root_message_id: reserved.thread_root_message_id,
                            message_id: args.message_id,
                            status: P2PSwapStatus::Accepted(accepted),
                        },
                        state,
                    );
                    state.award_achievement_and_notify(my_index, Achievement::AcceptedP2PSwapOffer, now);
                }
            });
            NotifyEscrowCanisterOfDepositJob::run(swap_id, my_principal);
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
    my_principal: Principal,
    escrow_canister_id: CanisterId,
    reserved: Reserved,
    now: TimestampMillis,
}

fn prepare_impl(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let this_canister_id = state.env.canister_id();
    let now = state.env.now();
    let escrow_canister_id = state.data.escrow_canister_id;
    state.with_caller_user_mut(|my_index, user| {
        let my_user_id = UserId::new_indexed(this_canister_id, my_index);
        // A user in this canister holds their funds under their own principal
        let my_principal = user.principal;
        let reserved = prepare(user, my_user_id, my_principal, this_canister_id, args, now)?;
        Ok(PrepareOk {
            my_index,
            my_user_id,
            my_principal,
            escrow_canister_id,
            reserved,
            now,
        })
    })
}
