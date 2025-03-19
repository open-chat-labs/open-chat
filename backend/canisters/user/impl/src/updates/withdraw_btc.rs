use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;
use constants::{CKBTC_LEDGER_CANISTER_ID, MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use user_canister::withdraw_btc::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn withdraw_btc(args: Args) -> Response {
    run_regular_jobs();

    let now_nanos = read_state(|state| state.env.now_nanos());

    match icrc_ledger_canister_c2c_client::icrc2_approve(
        CKBTC_LEDGER_CANISTER_ID,
        &icrc_ledger_canister::icrc2_approve::Args {
            from_subaccount: None,
            spender: CKBTC_MINTER_CANISTER_ID.into(),
            amount: args.amount.into(),
            expected_allowance: None,
            expires_at: Some(now_nanos + (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND)),
            fee: None,
            memo: None,
            created_at_time: Some(now_nanos),
        },
    )
    .await
    {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => return ApproveError(format!("{error:?}")),
        Err(error) => return InternalError(format!("{error:?}")),
    }

    match ckbtc_minter_canister_c2c_client::retrieve_btc_with_approval(
        CKBTC_MINTER_CANISTER_ID,
        &ckbtc_minter_canister::retrieve_btc_with_approval::Args {
            amount: args.amount,
            address: args.address,
            from_subaccount: None,
        },
    )
    .await
    {
        Ok(Ok(result)) => Success(result.block_index),
        Ok(Err(error)) => RetrieveBtcError(format!("{error:?}")),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
