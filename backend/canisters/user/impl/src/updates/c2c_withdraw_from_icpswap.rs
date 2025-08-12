use crate::guards::caller_is_local_user_index;
use crate::model::token_swaps::TokenSwap;
use crate::updates::swap_tokens::mark_withdrawal_success;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state, token_swaps};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, Timestamped};
use user_canister::c2c_withdraw_from_icpswap::*;
use user_canister::swap_tokens::ExchangeArgs;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_withdraw_from_icpswap(args: Args) -> Response {
    execute_update_async(|| c2c_withdraw_from_icpswap_impl(args)).await.into()
}

async fn c2c_withdraw_from_icpswap_impl(args: Args) -> OCResult {
    let PrepareOk {
        swap,
        ledger,
        amount,
        fee,
    } = read_state(|state| prepare(&args, state))?;

    let amount_out = token_swaps::icpswap::withdraw(swap.args.exchange_args.swap_canister_id(), ledger, amount, fee).await?;

    mutate_state(|state| mark_withdrawal_success(swap, !args.input_token, amount_out, true, state));
    Ok(())
}

struct PrepareOk {
    swap: TokenSwap,
    ledger: CanisterId,
    amount: u128,
    fee: u128,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareOk> {
    let Some(swap) = state
        .data
        .token_swaps
        .get(args.swap_id)
        .cloned()
        .filter(|s| matches!(s.args.exchange_args, ExchangeArgs::ICPSwap(_)))
    else {
        return Err(OCErrorCode::SwapNotFound.into());
    };

    let token_info = if args.input_token { &swap.args.input_token } else { &swap.args.output_token };
    let ledger = token_info.ledger;
    let fee = args.fee.unwrap_or(token_info.fee);

    let amount = if let Some(amount) = args.amount {
        amount
    } else if args.input_token {
        swap.args.input_amount.saturating_sub(fee)
    } else if let Some(Timestamped { value: Ok(Ok(v)), .. }) = &swap.swap_result {
        v.amount_out.saturating_sub(fee)
    } else {
        return Err(OCErrorCode::AmountNotSpecified.into());
    };

    Ok(PrepareOk {
        swap,
        ledger,
        amount,
        fee,
    })
}
