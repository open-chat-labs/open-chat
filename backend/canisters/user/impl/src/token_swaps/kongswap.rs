use super::swap_client::{SwapClient, SwapSuccess};
use crate::token_swaps::nat_to_u128;
use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use types::icrc1::Account;
use types::{CanisterId, TokenInfo};
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;

pub struct KongSwapClient {
    canister_id: CanisterId,
    token_in: TokenInfo,
    token_out: TokenInfo,
}

impl KongSwapClient {
    pub fn new(canister_id: CanisterId, token_in: TokenInfo, token_out: TokenInfo) -> KongSwapClient {
        KongSwapClient {
            canister_id,
            token_in,
            token_out,
        }
    }
}

#[async_trait]
impl SwapClient for KongSwapClient {
    fn canister_id(&self) -> CanisterId {
        self.canister_id
    }

    fn use_icrc2(&self) -> bool {
        true
    }

    fn auto_withdrawals(&self) -> bool {
        true
    }

    async fn deposit_account(&self) -> CallResult<Account> {
        panic!("`deposit_account` should not be called when using ICRC2")
    }

    async fn deposit(&self, _amount: u128) -> CallResult<u128> {
        panic!("`deposit` should not be called when using ICRC2")
    }

    async fn swap(&self, amount: u128, min_amount_out: u128) -> CallResult<Result<SwapSuccess, String>> {
        match kongswap_canister_c2c_client::swap(
            self.canister_id,
            &kongswap_canister::swap::Args {
                pay_amount: amount.into(),
                pay_token: format!("IC.{}", self.token_in.ledger),
                receive_amount: Some(min_amount_out.into()),
                receive_token: format!("IC.{}", self.token_out.ledger),
                referred_by: Some(SNS_GOVERNANCE_CANISTER_ID.to_string()),
            },
        )
        .await?
        {
            Ok(response) => {
                let amount_out = nat_to_u128(response.receive_amount);
                Ok(Ok(SwapSuccess {
                    amount_out,
                    withdrawal_success: Some(response.claim_ids.is_empty()),
                }))
            }
            Err(error) => Ok(Err(error)),
        }
    }

    async fn withdraw(&self, _successful_swap: bool, _amount: u128) -> CallResult<u128> {
        panic!("`withdraw` should not be called when `AUTO_WITHDRAWALS` is true")
    }
}
