use crate::model::user::{PhoneStatus, User};
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use types::{CanisterUpgradeStatus, CryptocurrencyAccount};
use user_index_canister::current_user::{Response::*, *};

#[query]
fn current_user(_args: Args) -> Response {
    read_state(current_user_impl)
}

fn current_user_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let latest_wasm_version = &runtime_state.data.user_canister_wasm.version;

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => Unconfirmed(UnconfirmedResult {
                state: u.state.clone().into(),
            }),
            User::Confirmed(u) => {
                if u.username.is_none() {
                    ConfirmedPendingUsername(ConfirmedPendingUsernameResult {
                        canister_creation_status: u.canister_creation_status.into(),
                        confirmation_state: u.confirmation_state(),
                    })
                } else {
                    Confirmed(ConfirmedResult {
                        canister_creation_status: u.canister_creation_status.into(),
                        username: u.username.as_ref().unwrap().clone(),
                        confirmation_state: u.confirmation_state(),
                    })
                }
            }
            User::Created(u) => {
                let canister_upgrade_status = if u.upgrade_in_progress {
                    CanisterUpgradeStatus::InProgress
                } else if &u.wasm_version < latest_wasm_version {
                    CanisterUpgradeStatus::Required
                } else {
                    CanisterUpgradeStatus::NotRequired
                };

                let icp_account = CryptocurrencyAccount::ICP(AccountIdentifier::new(&u.user_id.into(), &DEFAULT_SUBACCOUNT));
                let cycles_account = CryptocurrencyAccount::Cycles(u.user_id.into());
                let unconfirmed_phone_number = match &u.phone_status {
                    PhoneStatus::Unconfirmed(unconfirmed_phone_number) => Some(UnconfirmedPhoneNumber {
                        phone_number: unconfirmed_phone_number.phone_number.clone(),
                        valid_until: unconfirmed_phone_number.valid_until,
                    }),
                    _ => None,
                };

                Created(CreatedResult {
                    user_id: u.user_id,
                    username: u.username.clone(),
                    canister_upgrade_status,
                    avatar_id: u.avatar_id,
                    cryptocurrency_accounts: vec![icp_account, cycles_account],
                    wasm_version: u.wasm_version,
                    open_storage_limit_bytes: u.open_storage_limit_bytes,
                    unconfirmed_phone_number,
                })
            }
        }
    } else {
        UserNotFound
    }
}
