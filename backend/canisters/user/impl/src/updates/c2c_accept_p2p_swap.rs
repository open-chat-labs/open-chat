use crate::guards::caller_is_known_group_or_community_canister;
use crate::model::p2p_swaps::P2PSwap;
use crate::model::pin_number::VerifyPinError;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MEMO_P2P_SWAP_ACCEPT, NANOS_PER_MILLISECOND};
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use types::{CanisterId, TimestampMillis, UserId};
use user_canister::c2c_accept_p2p_swap::{Response::*, *};

#[update(guard = "caller_is_known_group_or_community_canister", msgpack = true)]
#[trace]
async fn c2c_accept_p2p_swap(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        my_user_id,
        escrow_canister_id,
        now,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(
        args.token1.ledger,
        &TransferArg {
            from_subaccount: None,
            to: Account {
                owner: escrow_canister_id,
                subaccount: Some(deposit_subaccount(my_user_id, args.swap_id)),
            },
            fee: Some(args.token1.fee.into()),
            created_at_time: Some(now * NANOS_PER_MILLISECOND),
            memo: Some(MEMO_P2P_SWAP_ACCEPT.to_vec().into()),
            amount: (args.token1_amount + args.token1.fee).into(),
        },
    )
    .await
    {
        Ok(Ok(index_nat)) => {
            mutate_state(|state| {
                state.data.p2p_swaps.add(P2PSwap {
                    id: args.swap_id,
                    location: args.location,
                    created_by: args.created_by,
                    created: args.created,
                    token0: args.token0,
                    token0_amount: args.token0_amount,
                    token1: args.token1,
                    token1_amount: args.token1_amount,
                    expires_at: args.expires_at,
                });
            });
            Success(index_nat.0.try_into().unwrap())
        }
        Ok(Err(error)) => TransferError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Box<Response>> {
    if let Err(error) = state.data.pin_number.verify(args.pin.as_deref(), state.env.now()) {
        return Err(Box::new(match error {
            VerifyPinError::PinRequired => PinRequired,
            VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
            VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
        }));
    }

    Ok(PrepareResult {
        my_user_id: state.env.canister_id().into(),
        escrow_canister_id: state.data.escrow_canister_id,
        now: state.env.now(),
    })
}
