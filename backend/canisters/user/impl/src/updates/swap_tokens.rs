use crate::guards::caller_is_owner;
use crate::token_swaps::swap_client::SwapClient;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use icpswap_client::ICPSwapClient;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use types::TimestampMillis;
use user_canister::swap_tokens::{Response::*, *};
use utils::consts::MEMO_SWAP;
use utils::time::NANOS_PER_MILLISECOND;

#[update(guard = "caller_is_owner")]
#[trace]
async fn swap_tokens(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult { swap_client, now } = read_state(|state| prepare(&args, state));

    let (ledger, account) = match swap_client.deposit_account().await {
        Ok(da) => da,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(
        ledger,
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
        Ok(Ok(_)) => {}
        Ok(Err(error)) => return InternalError(format!("{error:?}")),
        Err(error) => return InternalError(format!("{error:?}")),
    };

    if let Err(error) = swap_client.deposit(args.input_amount).await {
        return InternalError(format!("{error:?}"));
    }

    let amount_swapped = match swap_client.swap(args.input_amount.saturating_sub(args.input_token.fee)).await {
        Ok(a) => a,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let amount_out = amount_swapped.saturating_sub(args.output_token.fee);

    if let Err(error) = swap_client.withdraw(amount_out).await {
        return InternalError(format!("{error:?}"));
    }

    Success(SuccessResult { amount_out })
}

struct PrepareResult {
    swap_client: Box<dyn SwapClient>,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &RuntimeState) -> PrepareResult {
    let this_canister_id = state.env.canister_id();
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

    PrepareResult {
        swap_client,
        now: state.env.now(),
    }
}
