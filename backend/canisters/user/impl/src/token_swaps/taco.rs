use super::swap_client::{SwapClient, SwapSuccess};
use crate::token_swaps::nat_to_u128;
use async_trait::async_trait;
use candid::Nat;
use serde::{Deserialize, Serialize};
use taco_exchange_canister::get_expected_receive_amount_batch_multi as batch_multi;
use taco_exchange_canister::{SplitLeg, SwapHop, SwapResult};
use types::icrc1::Account;
use types::{C2CError, CanisterId, TokenInfo};

// 10-fraction probe grid (10%, 20%, ..., 100%). Mirrors the treasury trader's
// scenario builder at TACO_Backend/src/treasury/treasury.mo:10646 — top-5 routes
// per fraction, single inter-canister call.
const PROBE_FRACTIONS_BP: [u128; 10] = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const TOP_ROUTES_PER_FRACTION: u128 = 5;
const MAX_LEGS: usize = 3;

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
        // TACO pushes the swap output back to the caller automatically as part
        // of swapMultiHop / swapSplitRoutes, so OC's separate withdraw step is
        // a no-op.
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
        // No-op for TACO: block-based verification happens inside the swap call.
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

        // OC passes `amount = amount_to_dex - input_token.fee`. The ledger block
        // recorded `amount_to_dex` being transferred. We assume TACO's per-token
        // transfer fee equals the ledger transfer fee.
        let transferred = amount.saturating_add(self.input_token.fee);
        let tfee = self.input_token.fee;
        let usable = transferred.saturating_sub(tfee);
        if usable == 0 {
            return Ok(Err("TACO swap: deposit too small to cover transfer fee".to_string()));
        }

        let token_in = self.input_token.ledger.to_string();
        let token_out = self.output_token.ledger.to_string();

        // Build the 10-fraction × top-5 grid request. We probe at `usable * bp / 10000`
        // (a pre-fee estimate good enough for route ranking; exact bps comes back
        // in the response).
        let probes: Vec<batch_multi::Request> = PROBE_FRACTIONS_BP
            .iter()
            .filter_map(|bp| {
                let amt = usable.saturating_mul(*bp) / 10000;
                if amt == 0 {
                    None
                } else {
                    Some(batch_multi::Request {
                        token_sell: token_in.clone(),
                        token_buy: token_out.clone(),
                        amount_sell: amt.into(),
                    })
                }
            })
            .collect();

        if probes.is_empty() {
            return Ok(Err("TACO swap: amount too small for any probe fraction".to_string()));
        }

        let batch = taco_exchange_canister_c2c_client::get_expected_receive_amount_batch_multi(
            self.swap_canister_id,
            (probes, Nat::from(TOP_ROUTES_PER_FRACTION)),
        )
        .await?;

        // Pull the live trading fee bps from any route (every route in the response
        // carries the same ICPfee snapshot).
        let fee_bps = match extract_trading_fee_bps(&batch) {
            Some(bps) => bps,
            None => return Ok(Err("TACO swap: no routes returned for any fraction".to_string())),
        };
        // Defensive clamp against the canister's enforced range [1, 50] bps.
        let fee_bps_clamped = fee_bps.clamp(1, 50);

        // Compute the true amount_in such that the recorded deposit covers
        //   amount_in * (10000 + fee_bps) / 10000 + tfee.
        let amount_in_total = usable.saturating_mul(10000) / (10000 + fee_bps_clamped);
        if amount_in_total == 0 {
            return Ok(Err("TACO swap: deposit too small to cover trading fee".to_string()));
        }

        // Greedy disjoint-pool selection (mirrors hopsSharePool at
        // TACO_Backend/src/treasury/treasury.mo:10895, max 3 legs).
        let selected = build_split_plan(&batch);
        if selected.is_empty() {
            return Ok(Err("TACO swap: no usable routes after disjoint-pool filtering".to_string()));
        }

        if selected.len() == 1 {
            execute_swap_multi_hop(
                self.swap_canister_id,
                token_in,
                token_out,
                amount_in_total,
                selected.into_iter().next().unwrap(),
                min_amount_out,
                block_index,
            )
            .await
        } else {
            let legs = make_split_legs(&selected, amount_in_total, min_amount_out);
            execute_swap_split_routes(
                self.swap_canister_id,
                token_in,
                token_out,
                legs,
                min_amount_out,
                block_index,
            )
            .await
        }
    }

    async fn withdraw(&self, _successful_swap: bool, amount: u128) -> Result<u128, C2CError> {
        // auto_withdrawals() == true means swap_tokens.rs skips this call.
        Ok(amount)
    }
}

// ── helpers ─────────────────────────────────────────────────────────────────

fn extract_trading_fee_bps(batch: &batch_multi::Response) -> Option<u128> {
    batch
        .iter()
        .flat_map(|req| req.routes.iter())
        .next()
        .map(|r| nat_to_u128(r.trading_fee_bps.clone()))
}

// Bidirectional pool-edge overlap check — verbatim port of `hopsSharePool` at
// TACO_Backend/src/treasury/treasury.mo:10895. Returns true if any hop in `a`
// shares a pool with any hop in `b` (a pool is identified by its unordered
// token pair, so {A→B} and {B→A} are the same pool).
fn routes_share_pool_edge(a: &[SwapHop], b: &[SwapHop]) -> bool {
    for ha in a {
        for hb in b {
            if (ha.token_in == hb.token_in && ha.token_out == hb.token_out)
                || (ha.token_in == hb.token_out && ha.token_out == hb.token_in)
            {
                return true;
            }
        }
    }
    false
}

// Walk all routes returned by BatchMulti (across all fractions), dedupe by route
// token path, then greedily keep routes that don't share any pool edge with an
// already-kept route. Stop at MAX_LEGS. Order follows discovery (matches
// treasury's iteration over `tacoDistinctRoutes`).
fn build_split_plan(batch: &batch_multi::Response) -> Vec<Vec<SwapHop>> {
    let mut seen_route_keys: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut kept: Vec<Vec<SwapHop>> = Vec::new();

    for req in batch {
        for route in &req.routes {
            if route.expected_buy_amount == Nat::from(0u32) {
                continue;
            }
            let hops: Vec<SwapHop> = route
                .hop_details
                .iter()
                .map(|h| SwapHop {
                    token_in: h.token_in.clone(),
                    token_out: h.token_out.clone(),
                })
                .collect();
            // For direct routes the canister returns hopDetails = [] AND
            // routeTokens = [tokenSell, tokenBuy]; synthesize a single hop.
            let hops = if hops.is_empty() && route.route_tokens.len() == 2 {
                vec![SwapHop {
                    token_in: route.route_tokens[0].clone(),
                    token_out: route.route_tokens[1].clone(),
                }]
            } else {
                hops
            };
            if hops.is_empty() {
                continue;
            }
            let key = route.route_tokens.join("→");
            if !seen_route_keys.insert(key) {
                continue;
            }
            if kept.iter().any(|k| routes_share_pool_edge(k, &hops)) {
                continue;
            }
            kept.push(hops);
            if kept.len() >= MAX_LEGS {
                return kept;
            }
        }
    }

    kept
}

// Build [SplitLeg] from selected routes: equal-split with remainder in the last
// leg, pro-rata `minLegOut`. Mirrors treasury.mo:11851.
fn make_split_legs(routes: &[Vec<SwapHop>], total: u128, min_out_total: u128) -> Vec<SplitLeg> {
    let num_legs = routes.len();
    let per_leg = total / num_legs as u128;
    routes
        .iter()
        .enumerate()
        .map(|(i, route)| {
            let amount_in = if i == num_legs - 1 {
                total.saturating_sub(per_leg.saturating_mul((num_legs - 1) as u128))
            } else {
                per_leg
            };
            let min_leg_out = if total > 0 {
                min_out_total.saturating_mul(amount_in) / total
            } else {
                0
            };
            SplitLeg {
                amount_in: amount_in.into(),
                route: route.clone(),
                min_leg_out: min_leg_out.into(),
            }
        })
        .collect()
}

async fn execute_swap_multi_hop(
    canister_id: CanisterId,
    token_in: String,
    token_out: String,
    amount_in: u128,
    route: Vec<SwapHop>,
    min_amount_out: u128,
    block_index: u64,
) -> Result<Result<SwapSuccess, String>, C2CError> {
    let response = taco_exchange_canister_c2c_client::swap_multi_hop(
        canister_id,
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

    Ok(map_swap_result(response))
}

async fn execute_swap_split_routes(
    canister_id: CanisterId,
    token_in: String,
    token_out: String,
    legs: Vec<SplitLeg>,
    min_amount_out: u128,
    block_index: u64,
) -> Result<Result<SwapSuccess, String>, C2CError> {
    let response = taco_exchange_canister_c2c_client::swap_split_routes(
        canister_id,
        (
            token_in,
            token_out,
            legs,
            min_amount_out.into(),
            block_index.into(),
        ),
    )
    .await?;

    Ok(map_swap_result(response))
}

fn map_swap_result(result: SwapResult) -> Result<SwapSuccess, String> {
    match result {
        SwapResult::Ok(ok) => Ok(SwapSuccess {
            amount_out: nat_to_u128(ok.amount_out),
            // TACO has already pushed the output to the caller, so OC should
            // consider the withdraw step complete.
            withdrawal_success: Some(true),
        }),
        SwapResult::Err(error) => Err(format!("{error:?}")),
    }
}
