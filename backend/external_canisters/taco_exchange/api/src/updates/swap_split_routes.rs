use crate::{SplitLeg, SwapResult};
use candid::Nat;

// Candid signature is positional:
//   swapSplitRoutes :
//     (tokenIn : text, tokenOut : text, splits : vec SplitLeg,
//      minAmountOut : nat, Block : nat) -> (SwapResult)
pub type Args = (String, String, Vec<SplitLeg>, Nat, Nat);

pub type Response = SwapResult;
