use crate::model::token_swaps::TokenSwap;
use crate::updates::swap_tokens::mark_withdrawal_success;
use crate::{mutate_state, read_state, run_regular_jobs, token_swaps, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister_c2c_client::LookupUserError;
use types::CanisterId;
use user_canister::swap_tokens::{ExchangeArgs, ICPSwapArgs};
use user_canister::withdraw_from_icpswap::{Response::*, *};

#[update(msgpack = true)]
#[trace]
async fn withdraw_from_icpswap(args: Args) -> Response {
    run_regular_jobs();

    let PrepareOk {
        caller,
        local_user_index_canister_id,
        swap,
        icpswap_args,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match local_user_index_canister_c2c_client::lookup_user(caller, local_user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => {}
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    let token = if args.input_token { swap.args.input_token.clone() } else { swap.args.output_token.clone() };

    match token_swaps::icpswap::withdraw(
        icpswap_args.swap_canister_id,
        token.ledger,
        args.amount.unwrap_or(swap.args.input_amount),
        args.fee.unwrap_or(token.fee),
    )
    .await
    {
        Ok(amount_out) => {
            mutate_state(|state| mark_withdrawal_success(swap, !args.input_token, amount_out, true, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareOk {
    caller: Principal,
    local_user_index_canister_id: CanisterId,
    swap: TokenSwap,
    icpswap_args: ICPSwapArgs,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareOk, Response> {
    let Some(swap) = state.data.token_swaps.get(args.swap_id).cloned() else {
        return Err(SwapNotFound);
    };
    let ExchangeArgs::ICPSwap(icpswap_args) = swap.args.exchange_args.clone() else {
        return Err(SwapNotFound);
    };

    Ok(PrepareOk {
        caller: state.env.caller(),
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        swap,
        icpswap_args,
    })
}
