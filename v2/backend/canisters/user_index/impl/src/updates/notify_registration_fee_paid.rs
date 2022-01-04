use crate::model::user::{ConfirmedUser, UnconfirmedUserState, User};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountBalanceArgs, MAINNET_LEDGER_CANISTER_ID};
use types::{CanisterCreationStatusInternal, ICPRegistrationFee, RegistrationFee};
use user_index_canister::notify_registration_fee_paid::{Response::*, *};

#[update]
#[trace]
async fn notify_registration_fee_paid(_args: Args) -> Response {
    match read_state(extract_principal_and_fee) {
        Ok((principal, fee)) => match fee {
            RegistrationFee::ICP(icp_fee) => match check_icp_fee_has_been_paid(&icp_fee).await {
                Ok(true) => {
                    mutate_state(|state| confirm_user(principal, RegistrationFee::ICP(icp_fee), state));
                    Success
                }
                Ok(false) => PaymentNotFound,
                Err(error) => InternalError(error),
            },
            _ => PaymentNotFound,
        },
        Err(response) => response,
    }
}

fn extract_principal_and_fee(runtime_state: &RuntimeState) -> Result<(Principal, RegistrationFee), Response> {
    let caller = runtime_state.env.caller();

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        if let User::Unconfirmed(u) = user {
            match &u.state {
                UnconfirmedUserState::RegistrationFee(f) => Ok((caller, f.clone())),
                _ => Err(PaymentNotFound),
            }
        } else {
            Err(AlreadyRegistered)
        }
    } else {
        Err(UserNotFound)
    }
}

async fn check_icp_fee_has_been_paid(fee: &ICPRegistrationFee) -> Result<bool, String> {
    match ic_ledger_types::account_balance(MAINNET_LEDGER_CANISTER_ID, AccountBalanceArgs { account: fee.recipient }).await {
        Ok(balance) => Ok(balance >= fee.amount),
        Err(error) => Err(format!("{:?}", error)),
    }
}

fn confirm_user(principal: Principal, fee: RegistrationFee, runtime_state: &mut RuntimeState) {
    let user = ConfirmedUser {
        principal,
        phone_number: None,
        username: None,
        date_confirmed: runtime_state.env.now(),
        canister_creation_status: CanisterCreationStatusInternal::Pending(None),
        upgrade_in_progress: false,
        registration_fee: Some(fee),
    };
    runtime_state.data.users.update(User::Confirmed(user));
}
