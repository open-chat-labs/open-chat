use crate::updates::approve_transfer;
use constants::{MINUTE_IN_MS, ONE_SEC_MINTER_CANISTER_ID};
use oc_error_codes::OCErrorCode;
use one_sec_minter_canister::{EvmAccount, IcpAccount, Token};
use serde::Serialize;
use types::{EvmChain, OCResult, TimestampNanos, UserId, icrc1};
use user_canister::withdraw_via_one_sec::Args;

pub fn token(token_symbol: &str) -> OCResult<Token> {
    match token_symbol.to_lowercase().as_str() {
        "usdc" => Ok(Token::USDC),
        "usdt" => Ok(Token::USDT),
        _ => Err(OCErrorCode::CurrencyNotSupported.into()),
    }
}

// The approval the OneSec minter needs to make the transfer, which the caller checks the user may
// grant via `approve_transfer::prepare` before calling `withdraw`
pub fn approval_args(args: &Args) -> user_canister::approve_transfer::Args {
    user_canister::approve_transfer::Args {
        spender: ONE_SEC_MINTER_CANISTER_ID.into(),
        ledger_canister_id: args.ledger_canister_id,
        amount: args.amount,
        expires_in: Some(5 * MINUTE_IN_MS),
        pin: None,
    }
}

// Approves the OneSec minter to take the amount from the user's account, then instructs it to make
// the transfer to the EVM address
pub async fn withdraw(
    args: &Args,
    token: Token,
    approval: user_canister::approve_transfer::Args,
    my_user_id: UserId,
    now_nanos: TimestampNanos,
) -> OCResult {
    approve_transfer::approve(approval, now_nanos).await?;

    match one_sec_minter_canister_c2c_client::transfer_icp_to_evm(
        ONE_SEC_MINTER_CANISTER_ID,
        &one_sec_minter_canister::transfer_icp_to_evm::Args {
            token,
            evm_account: EvmAccount {
                address: args.address.clone(),
            },
            icp_account: IcpAccount::ICRC(icrc1::Account::legacy_for_user(my_user_id).into()),
            evm_chain: args.evm_chain,
            icp_amount: args.amount.into(),
            evm_amount: None,
        },
    )
    .await?
    {
        one_sec_minter_canister::transfer_icp_to_evm::Response::Accepted(_) => Ok(()),
        one_sec_minter_canister::transfer_icp_to_evm::Response::Fetching(_) => unreachable!(),
        one_sec_minter_canister::transfer_icp_to_evm::Response::Failed(failed) => {
            Err(OCErrorCode::TransferFailed.with_message(&failed.error))
        }
    }
}

#[derive(Serialize)]
pub struct WithdrawalViaOneSecEventPayload {
    pub token_symbol: String,
    pub evm_chain: EvmChain,
    pub amount: u128,
}
