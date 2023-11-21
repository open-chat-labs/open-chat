use crate::guards::caller_is_owner;
use crate::model::token_swaps::TokenSwap;
use crate::token_swaps::swap_client::SwapClient;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use icpswap_client::ICPSwapClient;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use types::{TimestampMillis, Timestamped};
use user_canister::swap_tokens::{Response::*, *};
use utils::consts::MEMO_SWAP;
use utils::time::NANOS_PER_MILLISECOND;

#[update(guard = "caller_is_owner")]
#[trace]
async fn swap_tokens(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        swap_client,
        mut token_swap,
        now,
    } = mutate_state(|state| prepare(&args, state));

    let account = match swap_client.deposit_account().await {
        Ok(a) => {
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.deposit_account = Some(Timestamped::new(Ok(a), now));
                state.data.token_swaps.upsert(token_swap.clone());
            });
            a
        }
        Err(error) => {
            let msg = format!("{error:?}");
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.deposit_account = Some(Timestamped::new(Err(msg.clone()), now));
                token_swap.success = Some(Timestamped::new(false, now));
                state.data.token_swaps.upsert(token_swap);
            });
            return InternalError(msg);
        }
    };

    let transfer_result = match icrc_ledger_canister_c2c_client::icrc1_transfer(
        args.input_token.ledger,
        &TransferArg {
            from_subaccount: None,
            to: account,
            fee: Some(args.input_token.fee.into()),
            created_at_time: Some(now * NANOS_PER_MILLISECOND),
            memo: Some(MEMO_SWAP.to_vec().into()),
            amount: args.input_amount.into(),
        },
    )
    .await
    {
        Ok(Ok(index)) => Ok(index),
        Ok(Err(error)) => Err(format!("{error:?}")),
        Err(error) => Err(format!("{error:?}")),
    };
    match transfer_result {
        Ok(index) => {
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.transfer = Some(Timestamped::new(Ok(index.0.try_into().unwrap()), now));
                state.data.token_swaps.upsert(token_swap.clone());
            });
        }
        Err(msg) => {
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.notified_dex_at = Some(Timestamped::new(Err(msg.clone()), now));
                token_swap.success = Some(Timestamped::new(false, now));
                state.data.token_swaps.upsert(token_swap);
            });
            return InternalError(msg);
        }
    }

    if let Err(error) = swap_client.deposit(args.input_amount).await {
        let msg = format!("{error:?}");
        mutate_state(|state| {
            let now = state.env.now();
            token_swap.transfer = Some(Timestamped::new(Err(msg.clone()), now));
            state.data.token_swaps.upsert(token_swap);
            state.data.token_swaps.enqueue(args.swap_id);
            // Start job to retry swap
        });
        return InternalError(msg);
    } else {
        mutate_state(|state| {
            let now = state.env.now();
            token_swap.notified_dex_at = Some(Timestamped::new(Ok(()), now));
            state.data.token_swaps.upsert(token_swap.clone());
        });
    }

    let amount_swapped = match swap_client
        .swap(args.input_amount.saturating_sub(args.input_token.fee), args.min_output_amount)
        .await
    {
        Ok(a) => {
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.amount_swapped = Some(Timestamped::new(Ok(a), now));
                state.data.token_swaps.upsert(token_swap.clone());
            });
            a
        }
        Err(error) => {
            let msg = format!("{error:?}");
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.amount_swapped = Some(Timestamped::new(Err(msg.clone()), now));
                state.data.token_swaps.upsert(token_swap);
                state.data.token_swaps.enqueue(args.swap_id);
                // Start job to retry swap
            });
            return InternalError(msg);
        }
    };

    let amount_out = amount_swapped.saturating_sub(args.output_token.fee);

    if let Err(error) = swap_client.withdraw(amount_out).await {
        let msg = format!("{error:?}");
        mutate_state(|state| {
            let now = state.env.now();
            token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Err(msg.clone()), now));
            state.data.token_swaps.upsert(token_swap);
            state.data.token_swaps.enqueue(args.swap_id);
            // Start job to retry swap
        });
        return InternalError(msg);
    } else {
        mutate_state(|state| {
            let now = state.env.now();
            token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Ok(()), now));
            token_swap.success = Some(Timestamped::new(true, now));
            state.data.token_swaps.upsert(token_swap);
        });
    }

    Success(SuccessResult { amount_out })
}

struct PrepareResult {
    swap_client: Box<dyn SwapClient>,
    token_swap: TokenSwap,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> PrepareResult {
    let this_canister_id = state.env.canister_id();
    let now = state.env.now();
    let input_token = args.input_token.clone();
    let output_token = args.output_token.clone();

    let swap_client = match &args.exchange_args {
        ExchangeArgs::ICPSwap(icpswap) => {
            let (token0, token1) = if icpswap.zero_for_one { (input_token, output_token) } else { (output_token, input_token) };
            Box::new(ICPSwapClient::new(
                this_canister_id,
                icpswap.swap_canister_id,
                token0,
                token1,
                icpswap.zero_for_one,
            ))
        }
    };

    let token_swap = TokenSwap::new(args.clone(), now);
    state.data.token_swaps.upsert(token_swap.clone());

    PrepareResult {
        swap_client,
        token_swap,
        now,
    }
}
