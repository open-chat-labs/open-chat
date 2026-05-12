use crate::{HopDetail, SwapHop};
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

// Candid signature is positional:
//   getExpectedMultiHopAmount: (tokenIn: text, tokenOut: text, amountIn: nat) -> (Response)
pub type Args = (String, String, Nat);

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Response {
    #[serde(rename = "bestRoute")]
    pub best_route: Vec<SwapHop>,
    #[serde(rename = "expectedAmountOut")]
    pub expected_amount_out: Nat,
    #[serde(rename = "hopDetails")]
    pub hop_details: Vec<HopDetail>,
    pub hops: Nat,
    #[serde(rename = "priceImpact")]
    pub price_impact: f64,
    #[serde(rename = "routeTokens")]
    pub route_tokens: Vec<String>,
    #[serde(rename = "totalFee")]
    pub total_fee: Nat,
}
