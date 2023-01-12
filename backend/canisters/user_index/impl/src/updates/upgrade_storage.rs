use crate::model::account_billing::{AccountCharge, AccountChargeDetails, StorageAccountChargeDetails};
use crate::model::user::User;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{BlockIndex, TransferError};
use local_user_index_canister::c2c_notify_user_index_events::{LocalUserIndexEvent, StorageUpgraded};
use open_storage_index_canister::add_or_update_users::UserConfig;
use std::cmp::max;
use types::{nns::CryptoAmount, Cryptocurrency, ICP};
use user_index_canister::upgrade_storage::{Response::*, *};

const FEE_PER_GB: ICP = ICP::from_e8s(2 * ICP::SUBDIVIDABLE_BY); // 2 ICP
const BYTES_PER_1GB: u64 = 1024 * 1024 * 1024;

#[update]
#[trace]
async fn upgrade_storage(args: Args) -> Response {
    let PrepareResult {
        user,
        new_storage_limit_bytes,
        charge_amount,
    } = match read_state(|state| prepare(args, state)) {
        Ok(prepare_result) => prepare_result,
        Err(response) => return response,
    };

    let args = user_canister::c2c_charge_user_account::Args { amount: charge_amount };
    match user_canister_c2c_client::c2c_charge_user_account(user.user_id.into(), &args).await {
        Ok(result) => match result {
            user_canister::c2c_charge_user_account::Response::Success(block_index) => {
                mutate_state(|state| process_charge(user, new_storage_limit_bytes, charge_amount, block_index, state))
            }
            user_canister::c2c_charge_user_account::Response::TransferError(error) => process_error(error, charge_amount),
            user_canister::c2c_charge_user_account::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    user: User,
    new_storage_limit_bytes: u64,
    charge_amount: ICP,
}

fn prepare(args: Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    let new_storage_limit_bytes = args.new_storage_limit_bytes;

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        if new_storage_limit_bytes > BYTES_PER_1GB {
            return Err(StorageLimitExceeded(BYTES_PER_1GB));
        }

        let requested_storage_increase = new_storage_limit_bytes.saturating_sub(user.open_storage_limit_bytes);
        if requested_storage_increase > 0 {
            let charge_amount = calculate_charge(requested_storage_increase);

            Ok(PrepareResult {
                user: user.clone(),
                new_storage_limit_bytes,
                charge_amount,
            })
        } else {
            Err(SuccessNoChange)
        }
    } else {
        Err(UserNotFound)
    }
}

fn process_charge(
    user: User,
    new_storage_limit_bytes: u64,
    charge_amount: ICP,
    block_index: BlockIndex,
    runtime_state: &mut RuntimeState,
) -> Response {
    let now = runtime_state.env.now();

    let requested_storage_increase = new_storage_limit_bytes.saturating_sub(user.open_storage_limit_bytes);

    let charge = AccountCharge {
        amount: charge_amount,
        timestamp: now,
        block_index,
        details: AccountChargeDetails::Storage(StorageAccountChargeDetails {
            old_bytes_limit: user.open_storage_limit_bytes,
            new_bytes_limit: new_storage_limit_bytes,
        }),
    };

    runtime_state.data.users.record_account_charge(&user.user_id, charge);

    runtime_state
        .data
        .users
        .set_storage_limit(&user.user_id, new_storage_limit_bytes);

    runtime_state.data.push_event_to_local_user_index(
        user.user_id,
        LocalUserIndexEvent::StorageUpgraded(StorageUpgraded {
            user_id: user.user_id,
            cost: CryptoAmount {
                token: Cryptocurrency::InternetComputer,
                amount: charge_amount,
            },
            storage_added: requested_storage_increase,
            new_storage_limit: new_storage_limit_bytes,
        }),
    );

    runtime_state.data.open_storage_user_sync_queue.push(UserConfig {
        user_id: user.principal,
        byte_limit: new_storage_limit_bytes,
    });

    Success
}

fn process_error(transfer_error: TransferError, charge_amount: ICP) -> Response {
    match transfer_error {
        TransferError::InsufficientFunds { balance } => PaymentInsufficient(PaymentInsufficientResult {
            account_balance: balance,
            amount_required: charge_amount,
        }),
        error => InternalError(format!("{error:?}")),
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
