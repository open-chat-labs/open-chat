use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::icrc1::process_transaction;
use types::icrc1::PendingCryptoTransaction;
use types::{CanisterId, UserId};
use user_canister::submit_proposal::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn submit_proposal(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        my_user_id,
        proposals_bot_canister_id,
        transaction,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // Make the crypto transfer
    let completed_transaction = match process_transaction(transaction, my_user_id.into(), false).await {
        Ok(Ok(completed)) => completed,
        Ok(Err(failed)) => return TransferFailed(failed.error_message),
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let c2c_args = proposals_bot_canister::c2c_submit_proposal::Args {
        governance_canister_id: args.governance_canister_id,
        proposal: args.proposal,
        transaction: completed_transaction,
    };
    match proposals_bot_canister_c2c_client::c2c_submit_proposal(proposals_bot_canister_id, &c2c_args).await {
        Ok(proposals_bot_canister::c2c_submit_proposal::Response::Success) => Success,
        Ok(proposals_bot_canister::c2c_submit_proposal::Response::GovernanceCanisterNotSupported) => {
            GovernanceCanisterNotSupported
        }
        Ok(proposals_bot_canister::c2c_submit_proposal::Response::InsufficientPayment(min)) => InsufficientPayment(min),
        Ok(proposals_bot_canister::c2c_submit_proposal::Response::Retrying(error)) => Retrying(error),
        Ok(proposals_bot_canister::c2c_submit_proposal::Response::InternalError(error)) => InternalError(error),
        Err(error) => {
            mutate_state(|state| {
                state.data.fire_and_forget_handler.send(
                    proposals_bot_canister_id,
                    "c2c_submit_proposal_msgpack".to_string(),
                    msgpack::serialize_then_unwrap(c2c_args),
                )
            });
            Retrying(format!("{error:?}"))
        }
    }
}

struct PrepareResult {
    my_user_id: UserId,
    proposals_bot_canister_id: CanisterId,
    transaction: PendingCryptoTransaction,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.suspended.value {
        Err(UserSuspended)
    } else {
        Ok(PrepareResult {
            my_user_id: state.env.canister_id().into(),
            proposals_bot_canister_id: state.data.proposals_bot_canister_id,
            transaction: PendingCryptoTransaction {
                ledger: args.ledger,
                token: args.token.clone(),
                amount: args.proposal_rejection_fee + args.transaction_fee,
                to: state.data.proposals_bot_canister_id.into(),
                fee: args.transaction_fee,
                memo: None,
                created: state.env.now_nanos(),
            },
        })
    }
}
