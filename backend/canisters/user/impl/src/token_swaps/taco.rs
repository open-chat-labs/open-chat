use super::swap_client::{SwapClient, SwapSuccess};
use crate::token_swaps::nat_to_u128;
use async_trait::async_trait;
use candid::Nat;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use taco_exchange_canister::get_expected_receive_amount_batch_multi as batch_multi;
use taco_exchange_canister::{SplitLeg, SwapHop, SwapResult};
use types::icrc1::Account;
use types::{C2CError, CanisterId, TokenInfo};

// 10-fraction probe grid (10%, 20%, ..., 100%). Mirrors the treasury trader's
// scenario builder at TACO_Backend/src/treasury/treasury.mo:10646 — top-5 routes
// per fraction, single inter-canister call. Together with the route × fraction
// enumerator below this lets us discover asymmetric splits (e.g. 30%/70%)
// without further round-trips.
const NUM_FRACTIONS: usize = 10;
const STEP_BP: u128 = 1000;
const TOP_ROUTES_PER_FRACTION: u128 = 5;
const MAX_LEGS: usize = 3;
// 0.1% — must beat the unsplit baseline by this margin before we'll take on the
// extra slippage risk of a multi-leg execution. Matches the frontend's
// useSwapFlow composable.
const SPLIT_IMPROVEMENT_NUMERATOR: u128 = 1001;
const SPLIT_IMPROVEMENT_DENOMINATOR: u128 = 1000;

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

        // Build the 10-fraction × top-5 grid. Probe amounts are `usable * (i+1) / 10`
        // — a pre-trading-fee estimate good enough for routing; the exact bps
        // comes back inline in the response and is applied to the execution
        // amount below.
        let probes: Vec<batch_multi::Request> = (0..NUM_FRACTIONS)
            .filter_map(|i| {
                let bp = ((i as u128) + 1) * STEP_BP;
                let amt = usable.saturating_mul(bp) / 10000;
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

        // Pull the live trading fee bps from any route in the response (every
        // route carries the same ICPfee snapshot). Defensively clamp to TACO's
        // enforced range [1, 50].
        let fee_bps = match extract_trading_fee_bps(&batch) {
            Some(bps) => bps.clamp(1, 50),
            None => return Ok(Err("TACO swap: no routes returned for any fraction".to_string())),
        };

        // Compute the true amount_in such that the recorded deposit covers
        //   amount_in * (10000 + fee_bps) / 10000 + tfee  ← TACO's checkReceive.
        let amount_in_total = usable.saturating_mul(10000) / (10000 + fee_bps);
        if amount_in_total == 0 {
            return Ok(Err("TACO swap: deposit too small to cover trading fee".to_string()));
        }

        // Route × fraction enumeration — same algorithm the TACO frontend's
        // useSwapFlow composable runs (and the screenshot at chat shows producing
        // a 30/70 split). Disjoint-pool constraint mirrors hopsSharePool from
        // TACO_Backend/src/treasury/treasury.mo:10895.
        let plan = build_swap_plan(&batch);

        match plan {
            SwapPlan::Single(route) => execute_swap_multi_hop(
                self.swap_canister_id,
                token_in,
                token_out,
                amount_in_total,
                route,
                min_amount_out,
                block_index,
            )
            .await,
            SwapPlan::Multi(legs) => {
                let split_legs = make_split_legs(&legs, amount_in_total, min_amount_out);
                execute_swap_split_routes(
                    self.swap_canister_id,
                    token_in,
                    token_out,
                    split_legs,
                    min_amount_out,
                    block_index,
                )
                .await
            }
            SwapPlan::None => Ok(Err("TACO swap: no viable route found".to_string())),
        }
    }

    async fn withdraw(&self, _successful_swap: bool, amount: u128) -> Result<u128, C2CError> {
        // auto_withdrawals() == true means swap_tokens.rs skips this call.
        Ok(amount)
    }
}

// ── plan types ──────────────────────────────────────────────────────────────

enum SwapPlan {
    Single(Vec<SwapHop>),
    Multi(Vec<PlannedLeg>),
    None,
}

#[derive(Clone)]
struct PlannedLeg {
    /// Basis points of the total amount allocated to this leg (sums to 10000
    /// across all legs of a Multi plan).
    bp: u128,
    route: Vec<SwapHop>,
}

#[derive(Clone)]
struct QuoteEntry {
    bp: u128,
    route: Vec<SwapHop>,
    expected_out: u128,
    route_key: String,
    edge_keys: Vec<String>,
}

// ── helpers ─────────────────────────────────────────────────────────────────

fn extract_trading_fee_bps(batch: &batch_multi::Response) -> Option<u128> {
    batch
        .iter()
        .flat_map(|req| req.routes.iter())
        .next()
        .map(|r| nat_to_u128(r.trading_fee_bps.clone()))
}

fn normalize_edge(a: &str, b: &str) -> String {
    if a < b {
        format!("{a}|{b}")
    } else {
        format!("{b}|{a}")
    }
}

// Two leg's pool sets overlap iff they share any normalized edge.
fn edges_overlap(a: &[String], b: &[String]) -> bool {
    for ea in a {
        for eb in b {
            if ea == eb {
                return true;
            }
        }
    }
    false
}

// Materialize hops for a quote entry. For direct routes the canister returns
// hopDetails = [] AND routeTokens = [tokenSell, tokenBuy]; synthesize a single
// hop from the route_tokens in that case.
fn hops_from_route(route: &batch_multi::QuoteRoute) -> Vec<SwapHop> {
    if !route.hop_details.is_empty() {
        return route
            .hop_details
            .iter()
            .map(|h| SwapHop {
                token_in: h.token_in.clone(),
                token_out: h.token_out.clone(),
            })
            .collect();
    }
    if route.route_tokens.len() == 2 {
        return vec![SwapHop {
            token_in: route.route_tokens[0].clone(),
            token_out: route.route_tokens[1].clone(),
        }];
    }
    Vec::new()
}

// Flatten BatchMulti into entries (one per (fraction, route)). Dedupes by
// (bp, route_key) so each fraction sees each route at most once.
fn flatten_batch(batch: &batch_multi::Response) -> Vec<QuoteEntry> {
    let mut out: Vec<QuoteEntry> = Vec::new();
    let mut seen: HashSet<(u128, String)> = HashSet::new();
    for (i, req) in batch.iter().enumerate() {
        let bp = ((i as u128) + 1) * STEP_BP;
        for route in &req.routes {
            let expected = nat_to_u128(route.expected_buy_amount.clone());
            if expected == 0 {
                continue;
            }
            let hops = hops_from_route(route);
            if hops.is_empty() {
                continue;
            }
            let route_key = route.route_tokens.join("→");
            if !seen.insert((bp, route_key.clone())) {
                continue;
            }
            let edge_keys: Vec<String> = hops.iter().map(|h| normalize_edge(&h.token_in, &h.token_out)).collect();
            out.push(QuoteEntry {
                bp,
                route: hops,
                expected_out: expected,
                route_key,
                edge_keys,
            });
        }
    }
    out
}

// Route × fraction optimizer.
//
// 1. Flatten the BatchMulti grid into entries `{ bp, route, expected_out, edge_keys }`.
// 2. Baseline = top expected_out among entries at bp == 10000 (unsplit best).
// 3. Enumerate 2-leg and 3-leg combinations whose `bp`s sum to 10000 exactly,
//    whose routes are distinct, and whose edge_keys sets are pairwise disjoint.
// 4. Pick the combination with the largest sum of expected_out.
// 5. Accept the split only if it beats the baseline by > 0.1%; otherwise fall
//    back to the baseline's single route.
//
// This matches the TACO frontend's `useSwapFlow` composable behaviour
// (`Split Route 0.4% better output` in the screenshot at chat).
fn build_swap_plan(batch: &batch_multi::Response) -> SwapPlan {
    let entries = flatten_batch(batch);
    if entries.is_empty() {
        return SwapPlan::None;
    }

    // Baseline: top route at the 100% fraction.
    let baseline_entry = entries.iter().filter(|e| e.bp == 10000).max_by_key(|e| e.expected_out);
    let baseline_out = baseline_entry.map(|e| e.expected_out).unwrap_or(0);

    // Search for the highest-output split plan.
    let mut best_plan: Option<Vec<&QuoteEntry>> = None;
    let mut best_total: u128 = 0;

    let n = entries.len();

    // 2-leg combos
    for i in 0..n {
        for j in (i + 1)..n {
            let a = &entries[i];
            let b = &entries[j];
            if a.bp + b.bp != 10000 {
                continue;
            }
            if a.route_key == b.route_key {
                continue;
            }
            if edges_overlap(&a.edge_keys, &b.edge_keys) {
                continue;
            }
            let total = a.expected_out + b.expected_out;
            if total > best_total {
                best_total = total;
                best_plan = Some(vec![a, b]);
            }
        }
    }

    // 3-leg combos (TACO's swap_split_routes caps at 3 legs)
    if MAX_LEGS >= 3 {
        for i in 0..n {
            for j in (i + 1)..n {
                let a = &entries[i];
                let b = &entries[j];
                if a.bp + b.bp >= 10000 {
                    continue;
                }
                if a.route_key == b.route_key {
                    continue;
                }
                if edges_overlap(&a.edge_keys, &b.edge_keys) {
                    continue;
                }
                for k in (j + 1)..n {
                    let c = &entries[k];
                    if a.bp + b.bp + c.bp != 10000 {
                        continue;
                    }
                    if c.route_key == a.route_key || c.route_key == b.route_key {
                        continue;
                    }
                    if edges_overlap(&a.edge_keys, &c.edge_keys) || edges_overlap(&b.edge_keys, &c.edge_keys) {
                        continue;
                    }
                    let total = a.expected_out + b.expected_out + c.expected_out;
                    if total > best_total {
                        best_total = total;
                        best_plan = Some(vec![a, b, c]);
                    }
                }
            }
        }
    }

    // Acceptance: split must beat baseline by >0.1%, OR baseline must be unusable
    // (no 100%-fraction route returned anything).
    let threshold = baseline_out.saturating_mul(SPLIT_IMPROVEMENT_NUMERATOR) / SPLIT_IMPROVEMENT_DENOMINATOR;
    let accept_split = match (best_plan.as_ref(), baseline_out) {
        (Some(_), 0) => true,
        (Some(_), _) => best_total > threshold,
        (None, _) => false,
    };

    if accept_split {
        let legs = best_plan
            .unwrap()
            .into_iter()
            .map(|e| PlannedLeg {
                bp: e.bp,
                route: e.route.clone(),
            })
            .collect();
        return SwapPlan::Multi(legs);
    }

    if let Some(e) = baseline_entry {
        return SwapPlan::Single(e.route.clone());
    }

    // No 100%-fraction route exists. Fall back to the highest-output entry we saw
    // (best-effort) — but only as a single-route execution since we have no
    // viable split.
    if let Some(e) = entries.iter().max_by_key(|e| e.expected_out) {
        return SwapPlan::Single(e.route.clone());
    }

    SwapPlan::None
}

// Build [SplitLeg] from a Multi plan: amount_in = total × bp / 10000, with the
// LAST leg carrying any rounding remainder so the sum is exactly `total`. The
// per-leg `minLegOut` is the pro-rata slice of the global min_amount_out (sums
// to min_amount_out within rounding).
fn make_split_legs(legs: &[PlannedLeg], total: u128, min_out_total: u128) -> Vec<SplitLeg> {
    let n = legs.len();
    let mut allocated_in: u128 = 0;
    let mut allocated_min: u128 = 0;
    let mut out = Vec::with_capacity(n);
    for (i, leg) in legs.iter().enumerate() {
        let (amount_in, min_leg_out) = if i + 1 == n {
            (
                total.saturating_sub(allocated_in),
                min_out_total.saturating_sub(allocated_min),
            )
        } else {
            let a = total.saturating_mul(leg.bp) / 10000;
            let m = min_out_total.saturating_mul(leg.bp) / 10000;
            allocated_in = allocated_in.saturating_add(a);
            allocated_min = allocated_min.saturating_add(m);
            (a, m)
        };
        out.push(SplitLeg {
            amount_in: amount_in.into(),
            route: leg.route.clone(),
            min_leg_out: min_leg_out.into(),
        });
    }
    out
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
