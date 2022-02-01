use super::refresh_account_balance::refresh_account_balance_impl;
use crate::model::account_billing::{AccountCharge, AccountChargeDetails, StorageAccountChargeDetails};
use crate::model::user::User;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use open_storage_index_canister::add_or_update_users::UserConfig;
use types::ICP;
use user_index_canister::refresh_account_balance;
use user_index_canister::upgrade_storage::{Response::*, *};

const FEE_PER_100MB: ICP = ICP::from_e8s(10_000_000); // 0.1 ICP
const BYTES_PER_100MB: u64 = 100 * 1000 * 1000;
const BYTES_PER_1GB: u64 = 10 * BYTES_PER_100MB;

#[update]
#[trace]
async fn upgrade_storage(args: Args) -> Response {
    if args.new_storage_limit_bytes > BYTES_PER_1GB {
        return StorageLimitExceeded(BYTES_PER_1GB);
    }

    let PrepareResult { caller, charge_amount } = match read_state(|state| prepare(&args, state)) {
        Ok(prepare_result) => prepare_result,
        Err(response) => return response,
    };

    match refresh_account_balance_impl().await {
        refresh_account_balance::Response::Success(refresh_account_balance::SuccessResult { account_credit })
        | refresh_account_balance::Response::SuccessNoChange(refresh_account_balance::SuccessResult { account_credit }) => {
            if account_credit.e8s() == 0 {
                PaymentNotFound
            } else {
                match account_credit.e8s().checked_sub(charge_amount.e8s()).map(ICP::from_e8s) {
                    Some(credit_remaining_after_charge) => mutate_state(|state| {
                        process_charge(
                            caller,
                            args.new_storage_limit_bytes,
                            charge_amount,
                            credit_remaining_after_charge,
                            state,
                        )
                    }),
                    None => PaymentInsufficient(PaymentInsufficientResult {
                        account_credit,
                        amount_required: charge_amount,
                    }),
                }
            }
        }
        refresh_account_balance::Response::UserNotFound => UserNotFound,
        refresh_account_balance::Response::InternalError(error) => InternalError(error),
    }
}

struct PrepareResult {
    caller: Principal,
    charge_amount: ICP,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        let requested_storage_increase = args.new_storage_limit_bytes.saturating_sub(user.open_storage_limit_bytes);
        if requested_storage_increase > 0 {
            let charge_amount = ICP::from_e8s((requested_storage_increase * FEE_PER_100MB.e8s()) / BYTES_PER_100MB);

            Ok(PrepareResult { caller, charge_amount })
        } else {
            Err(SuccessNoChange)
        }
    } else {
        Err(UserNotFound)
    }
}

fn process_charge(
    caller: Principal,
    new_storage_limit_bytes: u64,
    charge_amount: ICP,
    remaining_account_credit: ICP,
    runtime_state: &mut RuntimeState,
) -> Response {
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        let user_id = user.user_id;
        let now = runtime_state.env.now();

        let charge = AccountCharge {
            amount: charge_amount,
            timestamp: now,
            details: AccountChargeDetails::Storage(StorageAccountChargeDetails {
                old_bytes_limit: user.open_storage_limit_bytes,
                new_bytes_limit: new_storage_limit_bytes,
            }),
        };

        runtime_state.data.users.record_account_charge(&user_id, charge);
        runtime_state.data.users.set_storage_limit(&user_id, new_storage_limit_bytes);
        runtime_state.data.open_storage_user_sync_queue.push(UserConfig {
            user_id: caller,
            byte_limit: new_storage_limit_bytes,
        });

        Success(SuccessResult {
            remaining_account_credit,
        })
    } else {
        UserNotFound
    }
}
