use crate::{SwapHop, SwapResult};
use candid::Nat;

// Candid signature is positional:
//   swapMultiHop: (tokenIn: text, tokenOut: text, amountIn: nat,
//                  route: vec SwapHop, minAmountOut: nat, Block: nat) -> (SwapResult)
pub type Args = (String, String, Nat, Vec<SwapHop>, Nat, Nat);

pub type Response = SwapResult;
