use super::swap_client::{SwapClient, SwapSuccess};
use crate::token_swaps::nat_to_u128;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use taco_exchange_canister::{SwapHop, SwapResult};
use types::icrc1::Account;
use types::{C2CError, CanisterId, TokenInfo};

// TACO charges its trading fee on top of the bare swap amount (per-bp of input).
// On the canister side, `checkReceive` requires:
//     transferred >= amountIn * (10000 + tradingFeeBps) / 10000 + transferFee
// The current rate is 5 bps; if it changes we'll need to update this constant
// (the TACO treasury trader hardcodes the same value at
//  TACO_Backend/src/swap/taco_swap.mo:403).
const TACO_TRADING_FEE_BPS: u128 = 5;

#[derive(Serialize, Deserialize)]
pub struct TacoExchangeClient {
    swap_canister_id: CanisterId,
    input_token: TokenInfo,
    output_token: TokenInfo,
}

impl TacoExchangeClient {
    pub fn new(swap_canister_id: CanisterId, input_token: TokenInfo, output_token: TokenInfo) -> Self {
        TacoExchangeClient {
            swap_canister_id,
            input_token,
            output_token,
        }
    }
}

#[async_trait]
impl SwapClient for TacoExchangeClient {
    fn canister_id(&self) -> CanisterId {
        self.swap_canister_id
    }

    fn auto_withdrawals(&self) -> bool {
        // TACO pushes the swap output back to the caller automatically as
        // part of swapMultiHop, so OC's separate withdraw step is a no-op.
        true
    }

    async fn deposit_account(&self) -> Result<Account, C2CError> {
        // TACO verifies deposits by inspecting the ledger block; the recipient
        // is the exchange canister's default account.
        Ok(Account {
            owner: self.swap_canister_id,
            subaccount: None,
        })
    }

    async fn deposit(&self, amount: u128) -> Result<u128, C2CError> {
        // No-op for TACO: block-based verification happens inside swapMultiHop.
        Ok(amount)
    }

    async fn swap(
        &self,
        amount: u128,
        min_amount_out: u128,
        deposit_block_index: Option<u64>,
    ) -> Result<Result<SwapSuccess, String>, C2CError> {
        let block_index = match deposit_block_index {
            Some(b) => b,
            None => return Ok(Err("TACO swap requires a deposit block index".to_string())),
        };

        // OC's framework passes us `amount = amount_transferred - input_token.fee`.
        // Reconstruct the amount the ledger block actually records being moved.
        let transferred = amount.saturating_add(self.input_token.fee);

        // Solve for the largest bare swap amount that fits within `transferred`,
        // given TACO will require `amountIn * (10000 + fee_bps) / 10000 + Tfee`.
        // We assume TACO's per-token transfer fee equals the ledger transfer fee.
        let tfee = self.input_token.fee;
        let usable = transferred.saturating_sub(tfee);
        if usable == 0 {
            return Ok(Err("TACO swap: deposit too small to cover transfer fee".to_string()));
        }
        let amount_in = usable.saturating_mul(10000) / (10000 + TACO_TRADING_FEE_BPS);
        if amount_in == 0 {
            return Ok(Err("TACO swap: deposit too small to cover trading fee".to_string()));
        }

        let token_in = self.input_token.ledger.to_string();
        let token_out = self.output_token.ledger.to_string();

        let quote = taco_exchange_canister_c2c_client::get_expected_multi_hop_amount(
            self.swap_canister_id,
            (token_in.clone(), token_out.clone(), amount_in.into()),
        )
        .await?;

        if quote.best_route.is_empty() {
            return Ok(Err(format!(
                "TACO swap: no route from {} to {}",
                token_in, token_out
            )));
        }

        let route: Vec<SwapHop> = quote
            .best_route
            .into_iter()
            .map(|h| SwapHop {
                token_in: h.token_in,
                token_out: h.token_out,
            })
            .collect();

        let response = taco_exchange_canister_c2c_client::swap_multi_hop(
            self.swap_canister_id,
            (
                token_in,
                token_out,
                amount_in.into(),
                route,
                min_amount_out.into(),
                block_index.into(),
            ),
        )
        .await?;

        match response {
            SwapResult::Ok(ok) => Ok(Ok(SwapSuccess {
                amount_out: nat_to_u128(ok.amount_out),
                // TACO has already pushed the output back to the caller, so OC
                // should consider the withdraw step complete.
                withdrawal_success: Some(true),
            })),
            SwapResult::Err(error) => Ok(Err(format!("{error:?}"))),
        }
    }

    async fn withdraw(&self, _successful_swap: bool, amount: u128) -> Result<u128, C2CError> {
        // auto_withdrawals() == true means swap_tokens.rs skips this call, but
        // we implement it as a no-op for completeness.
        Ok(amount)
    }
}
