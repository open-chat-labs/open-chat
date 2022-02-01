use crate::model::account_billing::{AccountCharge, AccountChargeDetails, AccountPayment, StorageAccountChargeDetails};
use crate::model::user::User;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
use open_storage_index_canister::add_or_update_users::UserConfig;
use types::ICP;
use user_index_canister::notify_storage_upgrade_fee_paid::{Response::*, *};

const FEE_PER_100MB: ICP = ICP::from_e8s(10_000_000); // 0.1 ICP
const BYTES_PER_100MB: u64 = 100 * 1024 * 1024;
const BYTES_PER_1GB: u64 = 1000 * 1024 * 1024; // TODO we should be consistent between 1000 and 1024

#[update]
#[trace]
async fn notify_storage_upgrade_fee_paid(args: Args) -> Response {
    if args.new_storage_limit_bytes > BYTES_PER_1GB {
        return StorageLimitExceeded(BYTES_PER_1GB);
    }

    match read_state(|state| prepare(&args, state)) {
        Ok(ok) => match ic_ledger_types::account_balance(
            MAINNET_LEDGER_CANISTER_ID,
            AccountBalanceArgs {
                account: ok.billing_account,
            },
        )
        .await
        {
            Ok(balance) => mutate_state(|state| process_balance(args, ok.caller, balance, state)),
            Err(error) => InternalError(format!("{error:?}")),
        },
        Err(response) => response,
    }
}

struct PrepareResult {
    caller: Principal,
    billing_account: AccountIdentifier,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        if user.open_storage_limit_bytes < args.new_storage_limit_bytes {
            Ok(PrepareResult {
                caller,
                billing_account: runtime_state.user_billing_account(caller.into()),
            })
        } else {
            Err(SuccessNoChange)
        }
    } else {
        Err(UserNotFound)
    }
}

fn process_balance(args: Args, caller: Principal, balance: ICP, runtime_state: &mut RuntimeState) -> Response {
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        let user_id = user.user_id;
        let previous_balance = user.account_billing.ledger_balance();

        if balance > previous_balance {
            let payment_amount = balance - previous_balance;
            let previous_storage_limit = user.open_storage_limit_bytes;
            let previous_credit = user.account_billing.credit();
            let new_credit = previous_credit + payment_amount;
            let requested_storage_increase = args.new_storage_limit_bytes - previous_storage_limit;
            let required_credit = ICP::from_e8s((requested_storage_increase * FEE_PER_100MB.e8s()) / BYTES_PER_100MB);
            let now = runtime_state.env.now();

            runtime_state.data.users.record_account_payment(
                &user_id,
                AccountPayment {
                    amount: payment_amount,
                    timestamp: now,
                },
            );

            if new_credit >= required_credit {
                let charge = AccountCharge {
                    amount: required_credit,
                    timestamp: now,
                    details: AccountChargeDetails::Storage(StorageAccountChargeDetails {
                        old_bytes_limit: previous_storage_limit,
                        new_bytes_limit: args.new_storage_limit_bytes,
                    }),
                };
                runtime_state.data.users.record_account_charge(&user_id, charge);

                runtime_state
                    .data
                    .users
                    .set_storage_limit(&user_id, args.new_storage_limit_bytes);

                runtime_state.data.open_storage_user_sync_queue.push(UserConfig {
                    user_id: caller,
                    byte_limit: args.new_storage_limit_bytes,
                });

                Success(SuccessResult {
                    remaining_account_credit: new_credit - required_credit,
                })
            } else {
                PaymentInsufficient(PaymentInsufficientResult {
                    account_credit: new_credit,
                    amount_required: required_credit,
                })
            }
        } else {
            PaymentNotFound
        }
    } else {
        UserNotFound
    }
}
