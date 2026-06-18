use crate::SwapHop;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

// Candid signature:
//   getExpectedReceiveAmountBatchMultiOptimal :
//     (tokenSell : text, tokenBuy : text, amountIn : nat)
//     -> (OptimalSwapPlan) query
//
// TACO runs the BatchMulti probe grid + 2/3-leg split optimizer internally and
// returns just the chosen plan. Single-leg plans go to swapMultiHop; multi-leg
// plans go to swapSplitRoutes.
pub type Args = (String, String, Nat);
pub type Response = OptimalSwapPlan;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptimalSwapPlan {
    #[serde(rename = "expectedBuyAmount")]
    pub expected_buy_amount: Nat,
    pub fee: Nat,
    #[serde(rename = "priceImpact")]
    pub price_impact: f64,
    #[serde(rename = "canFulfillFully")]
    pub can_fulfill_fully: bool,
    #[serde(rename = "tradingFeeBps")]
    pub trading_fee_bps: Nat,
    #[serde(rename = "routeDescription")]
    pub route_description: String,
    pub legs: Vec<OptimalSwapLeg>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptimalSwapLeg {
    pub bp: Nat,
    #[serde(rename = "expectedBuyAmount")]
    pub expected_buy_amount: Nat,
    pub route: Vec<SwapHop>,
    #[serde(rename = "routeDescription")]
    pub route_description: String,
}
