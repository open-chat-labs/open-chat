use crate::model::user::User;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use types::{CanisterUpgradeStatus, Cryptocurrency, CryptocurrencyAccount, PhoneNumber};
use user_index_canister::current_user::{Response::*, *};

#[query]
fn current_user(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| current_user_impl(state.borrow().as_ref().unwrap()))
}

fn current_user_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let latest_wasm_version = &runtime_state.data.user_canister_wasm.version;

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                let mut phone_number: Option<PhoneNumber> = None;
                let wallet = u.wallet;
                if let Some(p) = &u.phone_number {
                    let now = runtime_state.env.now();
                    if !p.has_code_expired(now) {
                        phone_number = Some(p.phone_number.clone());
                    }
                }
                if phone_number.is_some() || wallet.is_some() {
                    Unconfirmed(UnconfirmedResult { phone_number, wallet })
                } else {
                    UserNotFound
                }
            }
            User::Confirmed(u) => {
                if u.username.is_none() {
                    ConfirmedPendingUsername(ConfirmedPendingUsernameResult {
                        canister_creation_status: u.canister_creation_status.into(),
                    })
                } else {
                    Confirmed(ConfirmedResult {
                        canister_creation_status: u.canister_creation_status.into(),
                        username: u.username.as_ref().unwrap().clone(),
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
                let icp_account = CryptocurrencyAccount {
                    currency: Cryptocurrency::ICP,
                    address: ledger_utils::calculate_address(u.user_id).to_hex(),
                };

                Created(CreatedResult {
                    user_id: u.user_id,
                    username: u.username.clone(),
                    canister_upgrade_status,
                    avatar_id: u.avatar_id,
                    cryptocurrency_accounts: vec![icp_account],
                })
            }
        }
    } else {
        UserNotFound
    }
}
