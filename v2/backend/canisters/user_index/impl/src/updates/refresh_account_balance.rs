use crate::model::account_billing::AccountPayment;
use crate::model::user::User;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
use types::ICP;
use user_index_canister::refresh_account_balance::{Response::*, *};

#[update]
#[trace]
async fn refresh_account_balance(_args: Args) -> Response {
    refresh_account_balance_impl().await
}

pub(crate) async fn refresh_account_balance_impl() -> Response {
    let PrepareResult { caller, billing_account } = match read_state(prepare) {
        Ok(prepare_result) => prepare_result,
        Err(response) => return response,
    };

    match ic_ledger_types::account_balance(
        MAINNET_LEDGER_CANISTER_ID,
        AccountBalanceArgs {
            account: billing_account,
        },
    )
    .await
    {
        Ok(balance) => mutate_state(|state| process_balance(caller, balance, state)),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    billing_account: AccountIdentifier,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if runtime_state.data.users.get_by_principal(&caller).is_some() {
        Ok(PrepareResult {
            caller,
            billing_account: runtime_state.user_billing_account(caller.into()),
        })
    } else {
        Err(UserNotFound)
    }
}

fn process_balance(caller: Principal, balance: ICP, runtime_state: &mut RuntimeState) -> Response {
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        let user_id = user.user_id;
        let previous_balance = user.account_billing.ledger_balance();

        if balance > previous_balance {
            let payment_amount = balance - previous_balance;
            let account_credit = user.account_billing.credit() + payment_amount;
            let now = runtime_state.env.now();
            runtime_state.data.users.record_account_payment(
                &user_id,
                AccountPayment {
                    amount: payment_amount,
                    timestamp: now,
                },
            );
            Success(SuccessResult { account_credit })
        } else {
            SuccessNoChange(SuccessResult {
                account_credit: user.account_billing.credit(),
            })
        }
    } else {
        UserNotFound
    }
}
