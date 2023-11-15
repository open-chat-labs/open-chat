use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use user_canister::approve_transfer::{Response::*, *};
use utils::time::NANOS_PER_MILLISECOND;

#[update(guard = "caller_is_owner")]
#[trace]
async fn approve_transfer(args: Args) -> Response {
    run_regular_jobs();

    let now_nanos = read_state(|state| state.env.now_nanos());

    match icrc_ledger_canister_c2c_client::icrc2_approve(
        args.ledger_canister_id,
        &ApproveArgs {
            from_subaccount: None,
            spender: args.spender,
            amount: (args.amount - args.fee).into(),
            expected_allowance: None,
            expires_at: args.expires_at.map(|expires_at| expires_at * NANOS_PER_MILLISECOND),
            fee: Some(args.fee.into()),
            memo: None,
            created_at_time: Some(now_nanos),
        },
    )
    .await
    {
        Ok(icrc_ledger_canister::icrc2_approve::Response::Ok(_)) => Success,
        Ok(icrc_ledger_canister::icrc2_approve::Response::Err(err)) => ApproveError(err),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
