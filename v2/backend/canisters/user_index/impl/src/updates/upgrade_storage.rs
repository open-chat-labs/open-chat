use crate::model::account_billing::{AccountCharge, AccountChargeDetails, StorageAccountChargeDetails};
use crate::model::user::User;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use open_storage_index_canister::add_or_update_users::UserConfig;
use std::cmp::max;
use types::ICP;
use user_index_canister::upgrade_storage::{Response::*, *};

const FEE_PER_GB: ICP = ICP::from_e8s(ICP::SUBDIVIDABLE_BY); // 0.1 ICP
const BYTES_PER_1GB: u64 = 1024 * 1024 * 1024;

#[update]
#[trace]
fn upgrade_storage(args: Args) -> Response {
    mutate_state(|state| upgrade_storage_impl(args, state))
}

fn upgrade_storage_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        if args.new_storage_limit_bytes > BYTES_PER_1GB {
            return StorageLimitExceeded(BYTES_PER_1GB);
        }

        let requested_storage_increase = args.new_storage_limit_bytes.saturating_sub(user.open_storage_limit_bytes);
        if requested_storage_increase > 0 {
            let charge_amount = calculate_charge(requested_storage_increase);
            let account_credit = user.account_billing.credit();

            if account_credit == ICP::ZERO {
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
        } else {
            SuccessNoChange
        }
    } else {
        UserNotFound
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

const MIN_CHARGE: ICP = ICP::from_e8s(ICP::SUBDIVIDABLE_BY / 100);

// This calculates the exact charge in ICP and then rounds it to 2 decimal places
fn calculate_charge(requested_storage_increase_bytes: u64) -> ICP {
    let charge_amount = ICP::from_e8s((requested_storage_increase_bytes * FEE_PER_GB.e8s()) / BYTES_PER_1GB);

    let charge_amount_fraction = charge_amount.e8s() as f64 / ICP::SUBDIVIDABLE_BY as f64;
    let rounded_2_dp = (charge_amount_fraction * 100.0).round() / 100.0;

    ICP::from_e8s(max((rounded_2_dp * ICP::SUBDIVIDABLE_BY as f64) as u64, MIN_CHARGE.e8s()))
}
