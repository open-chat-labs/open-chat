use crate::model::user::{AccountPayment, User};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
use open_storage_index_canister::add_or_update_users::UserConfig;
use std::cmp::min;
use types::ICP;
use user_index_canister::notify_storage_upgrade_fee_paid::{Response::*, *};

const FEE_PER_100MB: ICP = ICP::from_e8s(10_000_000); // 0.1 ICP
const BYTES_PER_100MB: u64 = 100 * 1024 * 1024;
const BYTES_PER_1GB: u64 = 1000 * 1024 * 1024; // TODO we should be consistent between 1000 and 1024

#[update]
#[trace]
async fn notify_storage_upgrade_fee_paid(_args: Args) -> Response {
    match read_state(prepare) {
        Ok(ok) => match ic_ledger_types::account_balance(
            MAINNET_LEDGER_CANISTER_ID,
            AccountBalanceArgs {
                account: ok.ledger_account,
            },
        )
        .await
        {
            Ok(balance) => mutate_state(|state| process_balance(ok.caller, balance, state)),
            Err(error) => InternalError(format!("{error:?}")),
        },
        Err(response) => response,
    }
}

struct PrepareResult {
    caller: Principal,
    ledger_account: AccountIdentifier,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(User::Created(_)) = runtime_state.data.users.get_by_principal(&caller) {
        Ok(PrepareResult {
            caller,
            ledger_account: runtime_state.user_storage_upgrade_icp_account(caller.into()),
        })
    } else {
        Err(UserNotFound)
    }
}

fn process_balance(caller: Principal, balance: ICP, runtime_state: &mut RuntimeState) -> Response {
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        let user_id = user.user_id;
        let current_total_paid = ICP::from_e8s(user.account_payments.iter().map(|p| p.amount.e8s()).sum());

        if balance > current_total_paid {
            let amount_paid = balance - current_total_paid;
            let current_storage_limit = user.open_storage_limit_bytes;
            let new_storage_limit = min((balance.e8s() / FEE_PER_100MB.e8s()) * BYTES_PER_100MB, BYTES_PER_1GB);

            runtime_state.data.users.record_account_payment(
                &user_id,
                AccountPayment {
                    amount: amount_paid,
                    timestamp: runtime_state.env.now(),
                },
            );

            if new_storage_limit > current_storage_limit {
                runtime_state.data.users.set_storage_limit(&user_id, new_storage_limit);
                runtime_state.data.open_storage_user_sync_queue.push(UserConfig {
                    user_id: caller,
                    byte_limit: new_storage_limit,
                });

                Success(SuccessResult {
                    open_storage_bytes_limit: new_storage_limit,
                })
            } else {
                PaymentInsufficient
            }
        } else {
            PaymentNotFound
        }
    } else {
        UserNotFound
    }
}
