use crate::guards::caller_is_local_user_index;
use crate::model::token_swaps::TokenSwap;
use crate::updates::swap_tokens::mark_withdrawal_success;
use crate::{mutate_state, read_state, run_regular_jobs, token_swaps, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{CanisterId, Timestamped};
use user_canister::c2c_withdraw_from_icpswap::{Response::*, *};
use user_canister::swap_tokens::ExchangeArgs;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_withdraw_from_icpswap(args: Args) -> Response {
    run_regular_jobs();

    let PrepareOk {
        swap,
        ledger,
        amount,
        fee,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match token_swaps::icpswap::withdraw(swap.args.exchange_args.swap_canister_id(), ledger, amount, fee).await {
        Ok(amount_out) => {
            mutate_state(|state| mark_withdrawal_success(swap, !args.input_token, amount_out, true, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareOk {
    swap: TokenSwap,
    ledger: CanisterId,
    amount: u128,
    fee: u128,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareOk, Response> {
    let Some(swap) = state
        .data
        .token_swaps
        .get(args.swap_id)
        .cloned()
        .filter(|s| matches!(s.args.exchange_args, ExchangeArgs::ICPSwap(_)))
    else {
        return Err(SwapNotFound);
    };

    let token_info = if args.input_token { &swap.args.input_token } else { &swap.args.output_token };
    let ledger = token_info.ledger;
    let fee = token_info.fee;

    let amount = if let Some(amount) = args.amount {
        amount
    } else if args.input_token {
        swap.args.input_amount.saturating_sub(fee)
    } else if let Some(Timestamped { value: Ok(Ok(v)), .. }) = &swap.swap_result {
        v.amount_out.saturating_sub(fee)
    } else {
        return Err(AmountNotSpecified);
    };

    Ok(PrepareOk {
        swap,
        ledger,
        amount,
        fee,
    })
}
