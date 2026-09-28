use crate::guards::caller_is_local_user_index;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use oc_error_codes::OCErrorCode;
use tracing::{error, info};
use types::CanisterId;
use user_canister::c2c_sweep_funds::{Response::*, *};

// The ledgers are called in batches, so as not to fill the canister's queue of outgoing calls
const BATCH_SIZE: usize = 50;

// Called by the LocalUserIndex once the user has been imported into the MultiUser canister they are
// being migrated to and switched over to their new id, to move the canister's balance of each token
// into the user's own account, which is where the users of a MultiUser canister hold their funds.
// From then on the migration can't be cancelled, since the canister is being emptied ahead of being
// uninstalled. Not run via `execute_update`, since the canister is frozen for the migration.
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_sweep_funds(args: Args) -> Response {
    let Some((principal, now_nanos)) =
        mutate_state(|state| state.data.mark_migration_switched_over().map(|p| (p, state.env.now_nanos())))
    else {
        return Error(OCErrorCode::InvalidRequest.with_message("The user isn't being migrated"));
    };
    let from = Account::from(ic_cdk::api::canister_self());
    let to = Account::from(principal);

    let mut failed = Vec::new();
    for batch in args.ledgers.chunks(BATCH_SIZE) {
        let results = futures::future::join_all(batch.iter().map(|ledger| sweep(ledger.clone(), from, to, now_nanos))).await;
        failed.extend(results.into_iter().filter_map(|r| r.err()));
    }
    Success(SuccessResult { failed })
}

// Moves the canister's balance of the token, less the fee, into the user's account, if there is
// more than enough to cover the fee
async fn sweep(ledger: LedgerToSweep, from: Account, to: Account, now_nanos: u64) -> Result<(), CanisterId> {
    let ledger_canister_id = ledger.ledger_canister_id;
    let balance: u128 = match icrc_ledger_canister_c2c_client::icrc1_balance_of(ledger_canister_id, &from).await {
        Ok(balance) => balance.0.try_into().unwrap_or(u128::MAX),
        Err(error) => {
            error!(%ledger_canister_id, ?error, "Failed to get balance to sweep");
            return Err(ledger_canister_id);
        }
    };
    if balance <= ledger.fee {
        return Ok(());
    }

    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: Some(ledger.fee.into()),
        created_at_time: Some(now_nanos),
        memo: None,
        amount: (balance - ledger.fee).into(),
    };
    match ledger_utils::icrc1::make_transfer(ledger_canister_id, &args, true).await {
        Ok(Ok(_)) => {
            info!(%ledger_canister_id, balance, "Swept funds to the user's account");
            Ok(())
        }
        Ok(Err(error)) => {
            error!(%ledger_canister_id, error, "Failed to sweep funds");
            Err(ledger_canister_id)
        }
        Err(error) => {
            error!(%ledger_canister_id, ?error, "Failed to sweep funds");
            Err(ledger_canister_id)
        }
    }
}
