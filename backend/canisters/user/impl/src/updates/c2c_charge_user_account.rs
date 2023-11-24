use crate::guards::caller_is_user_index;
use crate::{read_state, run_regular_jobs};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use user_canister::c2c_charge_user_account::{Response::*, *};

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
async fn c2c_charge_user_account(args: Args) -> Response {
    run_regular_jobs();

    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);

    match icrc_ledger_canister_c2c_client::icrc1_transfer(
        args.ledger_canister_id,
        &TransferArg {
            from_subaccount: None,
            to: Account::from(user_index_canister_id),
            fee: None,
            created_at_time: None,
            memo: None,
            amount: args.amount.e8s().into(),
        },
    )
    .await
    {
        Ok(Ok(block_index)) => Success(block_index.0.try_into().unwrap()),
        Ok(Err(transfer_error)) => TransferErrorV2(transfer_error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
