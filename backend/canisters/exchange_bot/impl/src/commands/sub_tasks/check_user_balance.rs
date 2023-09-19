use crate::commands::CommandSubTaskResult;
use ledger_utils::{convert_to_subaccount, format_crypto_amount};
use types::icrc1::Account;
use types::{CanisterId, TokenInfo, UserId};

pub(crate) async fn check_user_balance(
    user_id: UserId,
    token: &TokenInfo,
    this_canister_id: CanisterId,
) -> CommandSubTaskResult<u128> {
    let account = Account {
        owner: this_canister_id,
        subaccount: Some(convert_to_subaccount(&user_id.into()).0),
    };

    match icrc1_ledger_canister_c2c_client::icrc1_balance_of(token.ledger, &account)
        .await
        .map(|a| u128::try_from(a.0).unwrap())
    {
        Ok(amount) => CommandSubTaskResult::Complete(amount, Some(format_crypto_amount(amount, token.decimals))),
        Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
    }
}
