use crate::guards::caller_is_user_index;
use crate::{read_state, run_regular_jobs};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use ic_ledger_types::{Memo, TransferArgs, DEFAULT_FEE};
use types::Cryptocurrency;
use user_canister::c2c_charge_user_account::{Response::*, *};

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
async fn c2c_charge_user_account(args: Args) -> Response {
    run_regular_jobs();

    let (user_index_ledger_account, ledger_canister_id) = read_state(|state| {
        (
            state.data.user_index_ledger_account(),
            Cryptocurrency::InternetComputer.ledger_canister_id(),
        )
    });

    match icp_ledger_canister_c2c_client::transfer(
        ledger_canister_id,
        &TransferArgs {
            memo: Memo(0),
            amount: args.amount - DEFAULT_FEE,
            fee: DEFAULT_FEE,
            from_subaccount: None,
            to: user_index_ledger_account,
            created_at_time: None,
        },
    )
    .await
    {
        Ok(Ok(block_index)) => Success(block_index),
        Ok(Err(transfer_error)) => TransferError(transfer_error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
