use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use ledger_utils::default_ledger_account;
use types::CanisterUpgradeStatus;
use user_index_canister::current_user::{Response::*, *};

#[query]
fn current_user(_args: Args) -> Response {
    read_state(current_user_impl)
}

fn current_user_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(u) = runtime_state.data.users.get_by_principal(&caller) {
        let canister_upgrade_status = if u.upgrade_in_progress {
            CanisterUpgradeStatus::InProgress
        } else {
            CanisterUpgradeStatus::NotRequired
        };

        let phone_status = match &u.phone_status {
            crate::model::user::PhoneStatus::Unconfirmed(unconfirmed_phone_number) => {
                PhoneStatus::Unconfirmed(UnconfirmedPhoneNumber {
                    phone_number: unconfirmed_phone_number.phone_number.clone(),
                    valid_until: unconfirmed_phone_number.valid_until,
                })
            }
            crate::model::user::PhoneStatus::Confirmed(_) => PhoneStatus::Confirmed,
            crate::model::user::PhoneStatus::None => PhoneStatus::None,
        };

        Success(SuccessResult {
            user_id: u.user_id,
            username: u.username.clone(),
            canister_upgrade_status,
            avatar_id: u.avatar_id,
            wasm_version: u.wasm_version,
            open_storage_limit_bytes: u.open_storage_limit_bytes,
            phone_status,
            icp_account: default_ledger_account(u.user_id.into()),
            referrals: runtime_state.data.users.referrals(&u.user_id),
        })
    } else {
        UserNotFound
    }
}
