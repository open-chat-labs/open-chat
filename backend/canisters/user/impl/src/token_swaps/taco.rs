use super::swap_client::{SwapClient, SwapSuccess};
use crate::token_swaps::nat_to_u128;
use async_trait::async_trait;
use candid::Nat;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
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
    treasury_canister_id: CanisterId,
    input_token: TokenInfo,
    output_token: TokenInfo,
}

impl TacoExchangeClient {
    pub fn new(
        swap_canister_id: CanisterId,
        treasury_canister_id: CanisterId,
        input_token: TokenInfo,
        output_token: TokenInfo,
    ) -> Self {
        TacoExchangeClient {
            swap_canister_id,
            treasury_canister_id,
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
        // of swap_multi_hop / swap_split_routes, so OC's separate withdraw step
        // is a no-op.
        //
        // EVENTUAL-CONSISTENCY NOTE — this is NOT the same guarantee ICPSwap
        // gives. ICPSwap's withdraw() awaits the actual ICRC1 transfer, so the
        // tokens are in the user canister before SuccessResult is returned.
        // TACO's transfer queue is async:
        //
        //   1. swap_multi_hop / swap_split_routes calls treasury.receive
        //      TransferTasks(queue, immediate = false) at the end. The
        //      `immediate` flag is `isInAllowedCanisters(caller)` which is
        //      FALSE for OC user canisters (TACO's allowedCanisters list is
        //      TACO-internal canisters only).
        //   2. With immediate=false, receiveTransferTasks just appends to
        //      transferQueue and sets a 5-second setTimer to drain a batch
        //      via transferTimer(false). See
        //      TACO_Backend/src/exchange/treasury.mo:141-190.
        //   3. swap_multi_hop returns to us as soon as receiveTransferTasks
        //      returns. The actual icrc1_transfer to this canister lands
        //      ~5-10 seconds later when the timer fires.
        //
        // Consequence: when OC reports SuccessResult { amount_out } to the
        // user, the tokens may not yet be in the user canister's balance.
        // They arrive a few seconds later via TACO's transfer timer. A
        // frontend that polls the wallet balance right after success will
        // briefly see stale state. Same for refunds on TACO-level failures
        // (SlippageExceeded, etc.) — the refund queued by TACO also rides
        // the 5s timer.
        //
        // Long-term fixes (not implemented):
        //  - implement `withdraw()` as a polling check that waits for the
        //    balance to reflect the expected amount before returning, OR
        //  - have TACO governance add OC user canisters to allowedCanisters
        //    so swap_multi_hop calls with immediate=true and drains the
        //    transfer queue synchronously before returning.
        //
        // No correctness issue: TACO's BlocksDone guard makes retries
        // idempotent, and tokens always arrive eventually via the queued
        // transfer.
        true
    }

    async fn deposit_account(&self) -> Result<Account, C2CError> {
        // TACO verifies deposits by inspecting the ledger block, looking for a
        // transfer to its `treasury_principal` (the exchange-treasury canister,
        // NOT the exchange canister itself — see TACO's checkReceive at
        // src/exchange/main.mo line 11235 and the treasury trader's reference
        // at src/swap/taco_swap.mo:19,440).
        Ok(Account {
            owner: self.treasury_canister_id,
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
        // Collect bps in parallel with probes so flatten_batch can label the
        // response entries with the actual submitted bp — without this, dropping
        // zero-amount probes via filter_map would shift the index and mislabel
        // surviving entries (e.g. a response for the 30% probe would be tagged
        // as 10% by index-derived bp).
        let (probes, probe_bps): (Vec<batch_multi::Request>, Vec<u128>) = (0..NUM_FRACTIONS)
            .filter_map(|i| {
                let bp = ((i as u128) + 1) * STEP_BP;
                let amt = usable.saturating_mul(bp) / 10000;
                if amt == 0 {
                    None
                } else {
                    Some((
                        batch_multi::Request {
                            token_sell: token_in.clone(),
                            token_buy: token_out.clone(),
                            amount_sell: amt.into(),
                        },
                        bp,
                    ))
                }
            })
            .unzip();

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
        let plan = build_swap_plan(&batch, &probe_bps);

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
// `bps` must contain the actual basis-points for each submitted probe, in the
// same order as the batch request. This avoids mislabeling responses when
// zero-amount probes were filtered out before submission.
fn flatten_batch(batch: &batch_multi::Response, bps: &[u128]) -> Vec<QuoteEntry> {
    let mut out: Vec<QuoteEntry> = Vec::new();
    let mut seen: HashSet<(u128, String)> = HashSet::new();
    for (req, bp) in batch.iter().zip(bps.iter().copied()) {
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

// Pre-enumerated bp tuples whose components are all ∈ {1000..9000} and sum to
// 10000 — the ONLY tuples that can form a full-coverage 2- or 3-leg split with
// the 10-fraction probe grid. The optimizer iterates these directly instead of
// scanning every pair / triple of entries, collapsing the search from
// C(50,2)+C(50,3) ≈ 21,000 iterations to ≈ 810.
const TWO_LEG_BP_PAIRS: &[(u128, u128)] = &[
    (1000, 9000),
    (2000, 8000),
    (3000, 7000),
    (4000, 6000),
    (5000, 5000),
];

const THREE_LEG_BP_TRIPLES: &[(u128, u128, u128)] = &[
    (1000, 1000, 8000),
    (1000, 2000, 7000),
    (1000, 3000, 6000),
    (1000, 4000, 5000),
    (2000, 2000, 6000),
    (2000, 3000, 5000),
    (2000, 4000, 4000),
    (3000, 3000, 4000),
];

// Route × fraction optimizer.
//
// Algorithm (matches the TACO frontend's `useSwapFlow` "Split Route" feature):
//
//   1. Flatten the BatchMulti grid into entries `{ bp, route, expected_out, edge_keys }`
//      and group them by bp; sort each group by expected_out descending.
//   2. Baseline = best entry at the 100% fraction; threshold = baseline + 0.1%.
//   3. Initialize `best_total = threshold`. Any combo that displaces it is by
//      definition acceptable (post-loop check becomes a simple `Some` test).
//   4. For each precomputed bp tuple that sums to 10000:
//        a. Upper-bound prune: skip the tuple if `Σ group_top(bp_i) ≤ best_total`.
//        b. Walk the cross-product of the matching entry groups, breaking inner
//           loops as soon as the running sum can no longer beat best_total
//           (sound because each group is sorted desc).
//        c. Within the iteration, reject combos that share a route_key or any
//           normalized pool edge.
//   5. Pick the combination with the largest sum of expected_out.
//
// Worst case is still the 5 pair tuples + 8 triple tuples × 5-route groups
// (~810 iterations); typical case prunes most of that out before any real work.
fn build_swap_plan(batch: &batch_multi::Response, probe_bps: &[u128]) -> SwapPlan {
    let entries = flatten_batch(batch, probe_bps);
    if entries.is_empty() {
        return SwapPlan::None;
    }

    // Group entries by their bp, then sort each group by expected_out desc so
    // we can early-break inner loops when the running sum stops beating
    // best_total.
    let mut by_bp: HashMap<u128, Vec<usize>> = HashMap::new();
    for (idx, e) in entries.iter().enumerate() {
        by_bp.entry(e.bp).or_default().push(idx);
    }
    for indices in by_bp.values_mut() {
        indices.sort_by(|&a, &b| entries[b].expected_out.cmp(&entries[a].expected_out));
    }

    let empty: Vec<usize> = Vec::new();
    let group = |bp: u128| -> &Vec<usize> { by_bp.get(&bp).unwrap_or(&empty) };
    let group_top_out = |bp: u128| -> u128 {
        group(bp).first().map(|&i| entries[i].expected_out).unwrap_or(0)
    };

    // Baseline: top route at 100% — after sorting it's the first entry.
    let baseline_idx = group(10000).first().copied();
    let baseline_out = baseline_idx.map(|i| entries[i].expected_out).unwrap_or(0);

    // Pre-seed best_total to the 0.1% threshold so every comparison during the
    // search also enforces the acceptance criterion. When baseline_out == 0
    // (no full-amount route), this collapses to best_total = 0 and any positive
    // combo wins.
    let mut best_total: u128 =
        baseline_out.saturating_mul(SPLIT_IMPROVEMENT_NUMERATOR) / SPLIT_IMPROVEMENT_DENOMINATOR;
    let mut best_plan: Option<Vec<usize>> = None;

    // ── 2-leg search ────────────────────────────────────────────────────────
    for &(bp_a, bp_b) in TWO_LEG_BP_PAIRS {
        // Tuple upper-bound prune.
        if group_top_out(bp_a) + group_top_out(bp_b) <= best_total {
            continue;
        }

        let group_a = group(bp_a);
        if bp_a == bp_b {
            for xi in 0..group_a.len() {
                let i = group_a[xi];
                let a_out = entries[i].expected_out;
                let next_out = group_a
                    .get(xi + 1)
                    .map(|&j| entries[j].expected_out)
                    .unwrap_or(0);
                // a_out is non-increasing in xi (sorted), and next_out ≤ a_out.
                // If even (a, next) can't beat, no later xi will.
                if a_out + next_out <= best_total {
                    break;
                }
                for &j in &group_a[xi + 1..] {
                    let total = a_out + entries[j].expected_out;
                    if total <= best_total {
                        break;
                    }
                    if pair_compatible(&entries[i], &entries[j]) {
                        best_total = total;
                        best_plan = Some(vec![i, j]);
                    }
                }
            }
        } else {
            let group_b = group(bp_b);
            let max_b_out = group_b
                .first()
                .map(|&j| entries[j].expected_out)
                .unwrap_or(0);
            for &i in group_a {
                let a_out = entries[i].expected_out;
                if a_out + max_b_out <= best_total {
                    break;
                }
                for &j in group_b {
                    let total = a_out + entries[j].expected_out;
                    if total <= best_total {
                        break;
                    }
                    if pair_compatible(&entries[i], &entries[j]) {
                        best_total = total;
                        best_plan = Some(vec![i, j]);
                    }
                }
            }
        }
    }

    // ── 3-leg search ────────────────────────────────────────────────────────
    if MAX_LEGS >= 3 {
        for &(bp_a, bp_b, bp_c) in THREE_LEG_BP_TRIPLES {
            // Tuple upper-bound prune.
            if group_top_out(bp_a) + group_top_out(bp_b) + group_top_out(bp_c) <= best_total {
                continue;
            }

            let group_a = group(bp_a);
            let group_b = group(bp_b);
            let group_c = group(bp_c);
            let same_ab = bp_a == bp_b;
            let same_bc = bp_b == bp_c;
            let max_c_out = group_c
                .first()
                .map(|&k| entries[k].expected_out)
                .unwrap_or(0);

            for xi in 0..group_a.len() {
                let i = group_a[xi];
                let a_out = entries[i].expected_out;
                let b_start = if same_ab { xi + 1 } else { 0 };
                if b_start >= group_b.len() {
                    continue;
                }
                let max_b_at_start = entries[group_b[b_start]].expected_out;
                if a_out + max_b_at_start + max_c_out <= best_total {
                    break;
                }

                for offset_j in 0..(group_b.len() - b_start) {
                    let xj = b_start + offset_j;
                    let j = group_b[xj];
                    let b_out = entries[j].expected_out;
                    if a_out + b_out + max_c_out <= best_total {
                        break;
                    }
                    if !pair_compatible(&entries[i], &entries[j]) {
                        continue;
                    }
                    let c_start = if same_bc { xj + 1 } else { 0 };
                    if c_start >= group_c.len() {
                        continue;
                    }
                    for &k in &group_c[c_start..] {
                        let total = a_out + b_out + entries[k].expected_out;
                        if total <= best_total {
                            break;
                        }
                        if pair_compatible(&entries[i], &entries[k])
                            && pair_compatible(&entries[j], &entries[k])
                        {
                            best_total = total;
                            best_plan = Some(vec![i, j, k]);
                        }
                    }
                }
            }
        }
    }

    // best_plan.is_some() ⇔ "split beats baseline by > 0.1%" because best_total
    // was pre-seeded to the threshold; no separate accept check needed.
    if let Some(legs_idx) = best_plan {
        let legs = legs_idx
            .into_iter()
            .map(|idx| PlannedLeg {
                bp: entries[idx].bp,
                route: entries[idx].route.clone(),
            })
            .collect();
        return SwapPlan::Multi(legs);
    }

    if let Some(i) = baseline_idx {
        return SwapPlan::Single(entries[i].route.clone());
    }

    // No 100%-fraction route exists. Best-effort: pick the highest-output entry
    // across the whole grid and execute it as a single route.
    if let Some(e) = entries.iter().max_by_key(|e| e.expected_out) {
        return SwapPlan::Single(e.route.clone());
    }

    SwapPlan::None
}

fn pair_compatible(a: &QuoteEntry, b: &QuoteEntry) -> bool {
    a.route_key != b.route_key && !edges_overlap(&a.edge_keys, &b.edge_keys)
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
