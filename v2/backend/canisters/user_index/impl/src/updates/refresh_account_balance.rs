use crate::model::account_billing::AccountPayment;
use crate::model::user::User;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
use types::{UserId, ICP};
use user_index_canister::refresh_account_balance::{Response::*, *};

#[update]
#[trace]
async fn refresh_account_balance(_args: Args) -> Response {
    refresh_account_balance_impl().await
}

pub(crate) async fn refresh_account_balance_impl() -> Response {
    let PrepareResult {
        user_id,
        previous_balance,
        billing_account,
    } = match read_state(prepare) {
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
        Ok(balance) => mutate_state(|state| process_balance(user_id, previous_balance, balance, state)),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    user_id: UserId,
    previous_balance: ICP,
    billing_account: AccountIdentifier,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        Ok(PrepareResult {
            user_id: user.user_id,
            previous_balance: user.account_billing.account_balance(),
            billing_account: runtime_state.user_billing_account(user.user_id),
        })
    } else {
        Err(UserNotFound)
    }
}

fn process_balance(user_id: UserId, previous_balance: ICP, new_balance: ICP, runtime_state: &mut RuntimeState) -> Response {
    if new_balance > previous_balance {
        let payment_amount = new_balance - previous_balance;
        let now = runtime_state.env.now();
        runtime_state.data.users.record_account_payment(
            &user_id,
            AccountPayment {
                amount: payment_amount,
                timestamp: now,
            },
        );
    }

    Success(SuccessResult {
        account_balance: new_balance,
    })
}
