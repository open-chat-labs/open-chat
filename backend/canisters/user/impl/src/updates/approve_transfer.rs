use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use types::TimestampNanos;
use user_canister::approve_transfer::{Response::*, *};
use utils::time::NANOS_PER_MILLISECOND;

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
async fn approve_transfer(args: Args) -> Response {
    run_regular_jobs();

    let now_nanos = match mutate_state(|state| prepare(&args, state)) {
        Ok(ts) => ts,
        Err(response) => return response,
    };

    match icrc_ledger_canister_c2c_client::icrc2_approve(
        args.ledger_canister_id,
        &ApproveArgs {
            from_subaccount: None,
            spender: args.spender.into(),
            amount: args.amount.into(),
            expected_allowance: None,
            expires_at: args
                .expires_in
                .map(|expires_in| now_nanos + expires_in * NANOS_PER_MILLISECOND),
            fee: None,
            memo: None,
            created_at_time: Some(now_nanos),
        },
    )
    .await
    {
        Ok(Ok(_)) => Success,
        Ok(Err(err)) => ApproveError(err),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<TimestampNanos, Response> {
    let now = state.env.now();

    if let Err(error) = state.data.pin_number.verify(args.pin.as_deref(), now) {
        return Err(match error {
            VerifyPinError::PinRequired => PinRequired,
            VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
            VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
        });
    }

    Ok(now * NANOS_PER_MILLISECOND)
}
