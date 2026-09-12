use crate::model::schedule::{PUZZLES_TO_KEEP, RESULTS_RETENTION_DAYS, forced_params, generators, weekday};
use crate::model::seed::candidate_seed;
use candid::Principal;
use canister_state_macros::canister_state;
use constants::DAY_IN_MS;
use daily_puzzle_canister::{CandidateView, PuzzleParams};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};
use tracing::error;
use types::{
    BuildVersion, CanisterId, Cycles, DailyPuzzle, DailyPuzzleConfig, DailyPuzzleResult, GameConfig, GameId, PuzzleHint,
    PuzzleNumber, TimestampMillis, Timestamped, UserId,
};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod registry;
mod updates;

/// Candidates generated per future puzzle number. Governance can veto any of them before the day
/// starts; the first non-vetoed one ships.
pub const CANDIDATE_POOL_SIZE: usize = 3;

/// Hard ceiling on a pool, because every veto asks for one more candidate and nothing else stops
/// that. Candidate indices are `u8`, so past 255 they would wrap and a veto would address the
/// wrong puzzle. Well below that: a pool this deep means governance is rejecting everything the
/// generator produces, and the answer to that is `regenerate_today` or a schedule change, not
/// another candidate.
pub const MAX_CANDIDATE_POOL: usize = 32;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();
        let current_number = Data::number_for(now);
        // Counted against the borrowed key, so a game id is cloned once rather than once per row
        let mut counts: BTreeMap<&GameId, u32> = BTreeMap::new();
        for (_, game_id, _) in self.data.results.keys() {
            *counts.entry(game_id).or_default() += 1;
        }
        let results_by_game: BTreeMap<GameId, u32> = counts.into_iter().map(|(g, c)| (g.clone(), c)).collect();

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            stable_memory_sizes: memory::memory_sizes(),
            config: self.data.config.clone(),
            game_configs: self.data.game_configs.clone(),
            schedule: self.data.schedule.clone(),
            current_number,
            current_puzzles: self
                .data
                .current_puzzles(now)
                .into_iter()
                .map(|p| CurrentPuzzleMetrics {
                    game_id: p.game_id.clone(),
                    tier: p.tier,
                })
                .collect(),
            puzzles_held: self
                .data
                .puzzles
                .iter()
                .map(|(n, games)| (*n, games.keys().cloned().collect()))
                .collect(),
            candidates_held: self
                .data
                .candidates
                .iter()
                .map(|(n, games)| {
                    (
                        *n,
                        games
                            .iter()
                            .map(|(g, pool)| (g.clone(), pool.iter().map(|c| c.vetoed).collect()))
                            .collect(),
                    )
                })
                .collect(),
            results_count: self.data.results.len() as u32,
            results_by_game,
            local_user_indexes: self.data.local_user_indexes.iter().copied().collect(),
            pending_pushes: self.data.pending_pushes.iter().copied().collect(),
            last_registry_refresh: self.data.last_registry_refresh,
            master_seed_set: self.data.master_seed != 0,
            regeneration: self.data.regeneration.clone(),
            aggregates: self.data.aggregates(now),
            test_mode: self.data.test_mode,
            canister_ids: CanisterIds {
                registry: self.data.registry_canister_id,
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Candidate {
    pub puzzle: DailyPuzzle,
    pub vetoed: bool,
}

/// A `regenerate_today` override: `params` replace the schedule entry for `number`, and `attempt`
/// salts its seeds so each regeneration produces a different puzzle.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Regeneration {
    pub number: PuzzleNumber,
    pub params: PuzzleParams,
    pub attempt: u32,
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub registry_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub rng_seed: [u8; 32],
    /// Set once from the first real rng seed; every puzzle seed derives from it.
    pub master_seed: u64,
    pub config: DailyPuzzleConfig,
    /// Per-game tuning; a game without an entry uses `GameConfig::default()`.
    pub game_configs: BTreeMap<GameId, GameConfig>,
    /// Length 7, indexed by weekday (0 = Monday).
    pub schedule: Vec<PuzzleParams>,
    pub puzzles: BTreeMap<PuzzleNumber, BTreeMap<GameId, DailyPuzzle>>,
    pub candidates: BTreeMap<PuzzleNumber, BTreeMap<GameId, Vec<Candidate>>>,
    #[serde(default)]
    pub regeneration: Option<Regeneration>,
    pub results: BTreeMap<(PuzzleNumber, GameId, UserId), DailyPuzzleResult>,
    pub local_user_indexes: HashSet<CanisterId>,
    pub pending_pushes: HashSet<CanisterId>,
    pub last_registry_refresh: TimestampMillis,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        registry_canister_id: CanisterId,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        schedule: Vec<PuzzleParams>,
        test_mode: bool,
    ) -> Data {
        Data {
            registry_canister_id,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            rng_seed: [0; 32],
            master_seed: 0,
            config: DailyPuzzleConfig::default(),
            game_configs: generators().iter().map(|g| (g.to_string(), GameConfig::default())).collect(),
            schedule,
            puzzles: BTreeMap::new(),
            candidates: BTreeMap::new(),
            regeneration: None,
            results: BTreeMap::new(),
            local_user_indexes: HashSet::new(),
            pending_pushes: HashSet::new(),
            last_registry_refresh: 0,
            test_mode,
        }
    }

    pub fn number_for(now: TimestampMillis) -> PuzzleNumber {
        (now / DAY_IN_MS) as PuzzleNumber
    }

    /// The schedule entry for `number`'s weekday, unless `regenerate_today` overrode that number.
    pub fn params_for(&self, number: PuzzleNumber) -> &PuzzleParams {
        self.regeneration
            .as_ref()
            .filter(|r| r.number == number)
            .map_or(&self.schedule[weekday(number)], |r| &r.params)
    }

    fn attempt_for(&self, number: PuzzleNumber) -> u32 {
        self.regeneration
            .as_ref()
            .filter(|r| r.number == number)
            .map_or(0, |r| r.attempt)
    }

    pub fn game_config_for(&self, game_id: &str) -> GameConfig {
        self.game_configs.get(game_id).cloned().unwrap_or_default()
    }

    /// Every puzzle for the current day, one per game.
    pub fn current_puzzles(&self, now: TimestampMillis) -> Vec<&DailyPuzzle> {
        self.puzzles
            .get(&Self::number_for(now))
            .map(|games| games.values().collect())
            .unwrap_or_default()
    }

    /// A day holds one puzzle. Keyed by game so a regeneration can swap the game, but a day that
    /// already has a puzzle never gets a second one, whatever the schedule now says for it.
    fn has_puzzle(&self, number: PuzzleNumber) -> bool {
        self.puzzles.get(&number).is_some_and(|games| !games.is_empty())
    }

    fn candidate_pool(&self, number: PuzzleNumber, game_id: &str) -> Option<&Vec<Candidate>> {
        self.candidates.get(&number).and_then(|games| games.get(game_id))
    }

    fn has_unvetoed_candidate(&self, number: PuzzleNumber, game_id: &str) -> bool {
        self.candidate_pool(number, game_id)
            .is_some_and(|pool| pool.iter().any(|c| !c.vetoed))
    }

    /// The puzzle number that needs another candidate generating, if any. The game is always the
    /// scheduled one for that number. Today's number only needs one usable candidate since it
    /// ships as soon as it exists; tomorrow's needs the full pool, or one more when every
    /// candidate has been vetoed.
    pub fn generation_needed(&self, now: TimestampMillis) -> Option<PuzzleNumber> {
        let current = Self::number_for(now);
        let game_id = &self.params_for(current).game_id;
        if !self.has_puzzle(current)
            && !self.has_unvetoed_candidate(current, game_id)
            && self.candidate_pool(current, game_id).map_or(0, |p| p.len()) < MAX_CANDIDATE_POOL
        {
            return Some(current);
        }
        let next = current + 1;
        let game_id = &self.params_for(next).game_id;
        if !self.has_puzzle(next) {
            let pool_size = self.candidate_pool(next, game_id).map_or(0, |p| p.len());
            if pool_size < CANDIDATE_POOL_SIZE
                || (!self.has_unvetoed_candidate(next, game_id) && pool_size < MAX_CANDIDATE_POOL)
            {
                return Some(next);
            }
        }
        None
    }

    /// Generates one candidate of the scheduled game for `number` and returns its index in that
    /// game's pool, or None when the scheduled game has no generator. Deterministic given
    /// `master_seed`, the schedule, the number and the index.
    pub fn generate_candidate(&mut self, number: PuzzleNumber) -> Option<u8> {
        let params = self.params_for(number).clone();
        let index = self.candidate_pool(number, &params.game_id).map_or(0, |p| p.len());
        // Keeps the `u8` index below honest whatever the caller asked for
        if index >= MAX_CANDIDATE_POOL {
            return None;
        }
        let seed = candidate_seed(
            self.master_seed,
            number,
            &params.game_id,
            index as u64,
            self.attempt_for(number),
        );
        let generated = generate(&params, seed)?;
        let puzzle = DailyPuzzle {
            game_id: params.game_id.clone(),
            number,
            tier: generated.tier,
            description: generated.description,
            solution: generated.solution,
            solution_pairs: generated.pairs,
            hints: generated.hints,
            starts_at: number as u64 * DAY_IN_MS,
            expires_at: (number as u64 + 1) * DAY_IN_MS,
            config: self.config.clone(),
            game_config: self.game_config_for(&params.game_id),
        };
        self.candidates
            .entry(number)
            .or_default()
            .entry(params.game_id)
            .or_default()
            .push(Candidate { puzzle, vetoed: false });
        Some(index as u8)
    }

    /// Ships today's scheduled puzzle from its candidate pool if it hasn't shipped yet, then
    /// prunes old state. Returns true when a puzzle was promoted (the callers push on that).
    pub fn ensure_puzzles(&mut self, now: TimestampMillis) -> bool {
        let current = Self::number_for(now);
        let game_id = self.params_for(current).game_id.clone();
        let mut promoted = false;
        if !self.has_puzzle(current)
            && let Some(pool) = self.candidate_pool(current, &game_id)
            && let Some(candidate) = pool.iter().find(|c| !c.vetoed)
        {
            let mut puzzle = candidate.puzzle.clone();
            puzzle.config = self.config.clone();
            puzzle.game_config = self.game_config_for(&game_id);
            self.puzzles.entry(current).or_default().insert(game_id, puzzle);
            self.candidates.remove(&current);
            promoted = true;
        }
        self.prune(now);
        promoted
    }

    /// Drops today's puzzle(s) and candidate pool and points today at `game_id` (or the schedule
    /// when None) with a fresh seed salt, so the generation job builds and ships a new one.
    pub fn regenerate_today(&mut self, game_id: Option<GameId>, now: TimestampMillis) -> Result<(), String> {
        let current = Self::number_for(now);
        let params = match game_id {
            Some(game_id) => forced_params(&self.schedule, &game_id).ok_or(format!("unknown game_id '{game_id}'"))?,
            None => self.schedule[weekday(current)].clone(),
        };
        let attempt = self.attempt_for(current) + 1;
        self.regeneration = Some(Regeneration {
            number: current,
            params,
            attempt,
        });
        self.puzzles.remove(&current);
        self.candidates.remove(&current);
        Ok(())
    }

    pub fn prune(&mut self, now: TimestampMillis) {
        let current = Self::number_for(now);
        self.candidates.retain(|n, _| *n >= current);
        if self.regeneration.as_ref().is_some_and(|r| r.number < current) {
            self.regeneration = None;
        }
        while self.puzzles.len() > PUZZLES_TO_KEEP {
            self.puzzles.pop_first();
        }
        let cutoff = current.saturating_sub(RESULTS_RETENTION_DAYS);
        self.results.retain(|(n, _, _), _| *n >= cutoff);
    }

    pub fn set_config(&mut self, config: DailyPuzzleConfig) {
        for puzzle in self.puzzles.values_mut().flat_map(|games| games.values_mut()) {
            puzzle.config = config.clone();
        }
        for candidate in self.candidates.values_mut().flat_map(|games| games.values_mut()).flatten() {
            candidate.puzzle.config = config.clone();
        }
        self.config = config;
    }

    pub fn set_game_config(&mut self, game_id: GameId, config: GameConfig) {
        for puzzle in self.puzzles.values_mut().filter_map(|games| games.get_mut(&game_id)) {
            puzzle.game_config = config.clone();
        }
        for candidate in self
            .candidates
            .values_mut()
            .filter_map(|games| games.get_mut(&game_id))
            .flatten()
        {
            candidate.puzzle.game_config = config.clone();
        }
        self.game_configs.insert(game_id, config);
    }

    /// Replaces the schedule and drops every future candidate pool so it regenerates. Takes
    /// effect from tomorrow: today keeps whatever has already shipped or been generated for it,
    /// and an active regeneration still overrides today. Use `regenerate_today` to change today.
    pub fn set_schedule(&mut self, schedule: Vec<PuzzleParams>, now: TimestampMillis) {
        self.schedule = schedule;
        let current = Self::number_for(now);
        self.candidates.retain(|n, _| *n <= current);
    }

    pub fn veto_candidate(&mut self, number: PuzzleNumber, game_id: &str, index: u8) -> bool {
        if let Some(candidate) = self
            .candidates
            .get_mut(&number)
            .and_then(|games| games.get_mut(game_id))
            .and_then(|pool| pool.get_mut(index as usize))
        {
            candidate.vetoed = true;
            true
        } else {
            false
        }
    }

    pub fn candidate_views(&self, number: PuzzleNumber) -> Vec<CandidateView> {
        self.candidates
            .get(&number)
            .map(|games| {
                games
                    .iter()
                    .flat_map(|(game_id, pool)| {
                        pool.iter().enumerate().map(|(index, c)| CandidateView {
                            game_id: game_id.clone(),
                            index: index as u8,
                            description: c.puzzle.description.clone(),
                            tier: c.puzzle.tier,
                            vetoed: c.vetoed,
                            hint_count: c.puzzle.hints.len() as u32,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Upserts by (number, game_id, user_id), dropping anything older than the retention window.
    pub fn upsert_results(&mut self, results: Vec<DailyPuzzleResult>, now: TimestampMillis) {
        let cutoff = Self::number_for(now).saturating_sub(RESULTS_RETENTION_DAYS);
        for result in results {
            if result.number >= cutoff {
                self.results
                    .insert((result.number, result.game_id.clone(), result.user_id), result);
            }
        }
    }

    pub fn aggregates(&self, now: TimestampMillis) -> Vec<PuzzleAggregate> {
        let current = Self::number_for(now);
        let from = current.saturating_sub(6);
        // Keyed by the borrowed game id, so it is cloned once per puzzle rather than once per solve
        let mut by_key: BTreeMap<(PuzzleNumber, &GameId), (Vec<u64>, u64)> = BTreeMap::new();
        for ((number, game_id, _), result) in self
            .results
            .range((from, String::new(), UserId::from(Principal::from_slice(&[])))..)
        {
            let entry = by_key.entry((*number, game_id)).or_default();
            entry.0.push(result.solve_time_ms);
            entry.1 += result.hints_used as u64;
        }
        by_key
            .into_iter()
            .map(|((number, game_id), (mut times, hints))| {
                times.sort_unstable();
                let solves = times.len();
                let median_solve_ms =
                    if solves % 2 == 1 { times[solves / 2] } else { (times[solves / 2 - 1] + times[solves / 2]) / 2 };
                PuzzleAggregate {
                    number,
                    tier: self.puzzles.get(&number).and_then(|g| g.get(game_id)).map(|p| p.tier),
                    game_id: game_id.clone(),
                    solves: solves as u32,
                    median_solve_ms,
                    mean_hints: hints as f64 / solves as f64,
                }
            })
            .collect()
    }
}

struct Generated {
    tier: u8,
    description: Vec<u8>,
    solution: Vec<u8>,
    /// The solution in hint-key space (`DailyPuzzle::solution_pairs`).
    pairs: Vec<(u16, u8)>,
    hints: Vec<PuzzleHint>,
}

/// Every generator crate has the same `Generated` and `Hint` shape but its own types, so this
/// converts any of them to the wire format.
///
/// Generation is fallible. `InvalidParams` means no puzzle of this game can exist for these
/// parameters whatever the seed, so the schedule entry is wrong; `Exhausted` means this seed found
/// nothing and another might. Nothing here advances the seed on its own (`attempt_for` only moves
/// when an operator calls `regenerate_today`), so either way the day stops here and the error is
/// logged rather than reported as a missing generator.
macro_rules! into_generated {
    ($game_id:expr, $generated:expr) => {{
        let generated = match $generated {
            Ok(generated) => generated,
            Err(error) => {
                error!(game_id = $game_id, ?error, "Puzzle generation failed");
                return None;
            }
        };
        Generated {
            tier: generated.tier as u8,
            description: generated.description,
            solution: generated.solution,
            pairs: generated.pairs,
            hints: generated
                .hints
                .into_iter()
                .map(|h| PuzzleHint {
                    technique: h.technique as u8,
                    focus: h.focus,
                    target: h.target,
                    conclusions: h.conclusions,
                })
                .collect(),
        }
    }};
}

/// Runs the generator registered for `params.game_id`; None when there isn't one. `black_pct`
/// only applies to light_up; the other games use their crate's default density knobs.
fn generate(params: &PuzzleParams, seed: u64) -> Option<Generated> {
    let easy = params.tier == 0;
    let (w, h) = (params.width, params.height);
    let generated = match params.game_id.as_str() {
        light_up::GAME_ID => into_generated!(
            light_up::GAME_ID,
            light_up::generate(
                seed,
                light_up::Params {
                    width: w,
                    height: h,
                    black_pct: params.black_pct,
                    symmetry: light_up::Symmetry::Rot2,
                    tier: if easy { light_up::Tier::Easy } else { light_up::Tier::Tricky },
                },
            )
        ),
        tents::GAME_ID => into_generated!(
            tents::GAME_ID,
            tents::generate(
                seed,
                tents::Params::default_for(w, h, if easy { tents::Tier::Easy } else { tents::Tier::Tricky }),
            )
        ),
        slant::GAME_ID => into_generated!(
            slant::GAME_ID,
            slant::generate(
                seed,
                slant::Params::default_for(w, h, if easy { slant::Tier::Easy } else { slant::Tier::Tricky }),
            )
        ),
        bridges::GAME_ID => into_generated!(
            bridges::GAME_ID,
            bridges::generate(
                seed,
                bridges::Params::default_for(w, h, if easy { bridges::Tier::Easy } else { bridges::Tier::Tricky }),
            )
        ),
        loopy::GAME_ID => into_generated!(
            loopy::GAME_ID,
            loopy::generate(
                seed,
                loopy::Params::default_for(w, h, if easy { loopy::Tier::Easy } else { loopy::Tier::Tricky }),
            )
        ),
        unruly::GAME_ID => into_generated!(
            unruly::GAME_ID,
            unruly::generate(
                seed,
                unruly::Params::default_for(w, h, if easy { unruly::Tier::Easy } else { unruly::Tier::Tricky }),
            )
        ),
        _ => return None,
    };
    Some(generated)
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub config: DailyPuzzleConfig,
    pub game_configs: BTreeMap<GameId, GameConfig>,
    pub schedule: Vec<PuzzleParams>,
    pub current_number: PuzzleNumber,
    pub current_puzzles: Vec<CurrentPuzzleMetrics>,
    /// Per number held, the games with a shipped puzzle.
    pub puzzles_held: BTreeMap<PuzzleNumber, Vec<GameId>>,
    /// Per future number and game, the veto flag of each candidate in the pool.
    pub candidates_held: BTreeMap<PuzzleNumber, BTreeMap<GameId, Vec<bool>>>,
    pub results_count: u32,
    pub results_by_game: BTreeMap<GameId, u32>,
    pub local_user_indexes: Vec<CanisterId>,
    pub pending_pushes: Vec<CanisterId>,
    pub last_registry_refresh: TimestampMillis,
    pub master_seed_set: bool,
    pub regeneration: Option<Regeneration>,
    pub aggregates: Vec<PuzzleAggregate>,
    pub test_mode: bool,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CurrentPuzzleMetrics {
    pub game_id: GameId,
    pub tier: u8,
}

#[derive(Serialize, Debug)]
pub struct PuzzleAggregate {
    pub number: PuzzleNumber,
    pub game_id: GameId,
    pub tier: Option<u8>,
    pub solves: u32,
    pub median_solve_ms: u64,
    pub mean_hints: f64,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub registry: CanisterId,
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::schedule::{
        default_schedule, forced_params, test_schedule, validate_config, validate_game_config, validate_schedule,
    };
    use crate::model::seed::puzzle_seed;

    const LU: &str = light_up::GAME_ID;

    /// light_up 7x7 easy every day, so tests can key candidate pools by `LU` on any number
    fn data() -> Data {
        let params = PuzzleParams {
            game_id: LU.to_string(),
            width: 7,
            height: 7,
            tier: 0,
            black_pct: 20,
        };
        let mut data = Data::new(
            Principal::anonymous(),
            Principal::anonymous(),
            Principal::anonymous(),
            vec![params; 7],
            true,
        );
        data.master_seed = 12345;
        data
    }

    /// Expected byte lengths of (description, solution) for a game's wire format
    fn wire_lengths(game_id: &str, w: usize, h: usize) -> (usize, usize) {
        match game_id {
            light_up::GAME_ID | bridges::GAME_ID | unruly::GAME_ID => (3 + w * h, w * h),
            tents::GAME_ID => (3 + w * h + h + w, w * h),
            slant::GAME_ID => (3 + (w + 1) * (h + 1), w * h),
            loopy::GAME_ID => (3 + w * h, (h + 1) * w + h * (w + 1)),
            other => panic!("unknown game {other}"),
        }
    }

    #[test]
    fn every_scheduled_game_generates_in_wire_format() {
        let mut seen = HashSet::new();
        // Every scheduled entry, plus one forced entry per registered generator so a game that
        // no schedule currently names (loopy, retired for being far harder than the rest) is
        // still proved to generate and to have usable default params.
        let forced = generators()
            .iter()
            .map(|g| forced_params(&[], g).unwrap_or_else(|| panic!("no default params for {g}")));
        for (i, params) in default_schedule()
            .into_iter()
            .chain(test_schedule())
            .chain(forced)
            .enumerate()
        {
            let generated = generate(&params, 1000 + i as u64).unwrap_or_else(|| panic!("no generator for {}", params.game_id));
            let (w, h) = (params.width as usize, params.height as usize);
            let (description_len, solution_len) = wire_lengths(&params.game_id, w, h);
            assert_eq!(generated.tier, params.tier, "{}", params.game_id);
            assert_eq!(generated.description[0], 1, "{}", params.game_id);
            assert_eq!(generated.description[1], params.width, "{}", params.game_id);
            assert_eq!(generated.description[2], params.height, "{}", params.game_id);
            assert_eq!(generated.description.len(), description_len, "{}", params.game_id);
            assert_eq!(generated.solution.len(), solution_len, "{}", params.game_id);
            assert!(!generated.hints.is_empty(), "{}", params.game_id);
            assert!(
                generated.hints.iter().all(|h| h.technique > 0 && !h.conclusions.is_empty()),
                "{}",
                params.game_id
            );
            assert!(!generated.pairs.is_empty(), "{}", params.game_id);
            assert!(
                generated.pairs.windows(2).all(|w| w[0].0 < w[1].0),
                "{}: pairs not sorted by key",
                params.game_id
            );
            let pairs: BTreeMap<u16, u8> = generated.pairs.iter().copied().collect();
            for hint in &generated.hints {
                for &(key, value) in &hint.conclusions {
                    assert_eq!(pairs.get(&key), Some(&value), "{}: hint key {key}", params.game_id);
                }
            }
            seen.insert(params.game_id);
        }
        assert_eq!(seen.len(), generators().len());
        assert!(generators().iter().all(|g| seen.contains(*g)));
        // The schedule itself need not cover every generator, but it must not name one we
        // cannot generate.
        assert!(
            default_schedule()
                .iter()
                .chain(test_schedule().iter())
                .all(|p| generators().contains(&p.game_id.as_str()))
        );

        let mut unknown = default_schedule().remove(0);
        unknown.game_id = "sudoku".to_string();
        assert!(generate(&unknown, 1).is_none());
    }

    #[test]
    fn game_configs_default_for_every_generator() {
        let d = data();
        assert_eq!(d.game_configs.len(), generators().len());
        for game_id in generators() {
            assert_eq!(d.game_configs[*game_id], GameConfig::default());
        }
    }

    fn result(number: PuzzleNumber, user: u8) -> DailyPuzzleResult {
        DailyPuzzleResult {
            game_id: LU.to_string(),
            number,
            user_id: UserId::from(Principal::from_slice(&[user])),
            solve_time_ms: 1000 * user as u64,
            hints_used: user,
            streak: 1,
            solved_at: 0,
        }
    }

    fn user(id: u8) -> UserId {
        UserId::from(Principal::from_slice(&[id]))
    }

    fn pool(d: &Data, number: PuzzleNumber) -> &Vec<Candidate> {
        &d.candidates[&number][LU]
    }

    #[test]
    fn seed_derivation_is_deterministic() {
        assert_eq!(puzzle_seed(7, 100, LU), puzzle_seed(7, 100, LU));
        assert_ne!(puzzle_seed(7, 100, LU), puzzle_seed(7, 101, LU));
        assert_ne!(puzzle_seed(7, 100, LU), puzzle_seed(8, 100, LU));
        assert_ne!(puzzle_seed(7, 100, LU), puzzle_seed(7, 100, "other"));
        assert_ne!(candidate_seed(7, 100, LU, 0, 0), candidate_seed(7, 100, LU, 1, 0));
        assert_ne!(candidate_seed(7, 100, LU, 0, 0), candidate_seed(7, 100, LU, 0, 1));
        assert_ne!(candidate_seed(7, 100, LU, 0, 1), candidate_seed(7, 100, LU, 0, 2));

        let mut a = data();
        let mut b = data();
        a.generate_candidate(100).unwrap();
        b.generate_candidate(100).unwrap();
        assert_eq!(pool(&a, 100)[0].puzzle.description, pool(&b, 100)[0].puzzle.description);
        assert_eq!(pool(&a, 100)[0].puzzle.solution, pool(&b, 100)[0].puzzle.solution);
    }

    #[test]
    fn weekday_mapping() {
        // 1970-01-01 (number 0) was a Thursday
        assert_eq!(weekday(0), 3);
        assert_eq!(weekday(4), 0);
        assert_eq!(weekday(10), 6);
        assert_eq!(weekday(11), 0);

        let mut d = data();
        d.schedule = default_schedule();
        assert_eq!(d.params_for(4).game_id, LU); // Monday
        assert_eq!(d.params_for(4).width, 7);
        assert_eq!(d.params_for(7).game_id, bridges::GAME_ID); // Thursday
        assert_eq!(d.params_for(9).game_id, tents::GAME_ID); // Saturday tricky
        assert_eq!(d.params_for(9).tier, 1);
        assert_eq!(d.params_for(10).game_id, LU); // Sunday tricky
        assert_eq!(d.params_for(10).width, 10);
    }

    #[test]
    fn ensure_puzzles_picks_first_non_vetoed_candidate() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        assert_eq!(d.generation_needed(now), Some(100));
        d.generate_candidate(100).unwrap();
        d.generate_candidate(100).unwrap();
        d.generate_candidate(100).unwrap();
        assert!(d.veto_candidate(100, LU, 0));
        let expected = pool(&d, 100)[1].puzzle.description.clone();

        assert!(d.ensure_puzzles(now));
        assert_eq!(d.puzzles[&100][LU].description, expected);
        assert_eq!(d.current_puzzles(now).len(), 1);
        assert!(!d.candidates.contains_key(&100));
        // Tomorrow's pool is now the outstanding work
        assert_eq!(d.generation_needed(now), Some(101));
    }

    #[test]
    fn ensure_puzzles_generates_new_candidate_when_all_vetoed() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        d.generate_candidate(100).unwrap();
        assert!(d.veto_candidate(100, LU, 0));
        assert!(!d.ensure_puzzles(now));
        assert!(!d.puzzles.contains_key(&100));
        assert!(d.current_puzzles(now).is_empty());
        assert_eq!(d.generation_needed(now), Some(100));

        let index = d.generate_candidate(100).unwrap();
        assert_eq!(index, 1);
        let expected = pool(&d, 100)[1].puzzle.description.clone();
        assert!(d.ensure_puzzles(now));
        assert_eq!(d.puzzles[&100][LU].description, expected);
        assert!(!d.candidates.contains_key(&100));

        // Tomorrow: a full pool, all vetoed, needs exactly one more
        for _ in 0..CANDIDATE_POOL_SIZE {
            d.generate_candidate(101).unwrap();
        }
        assert_eq!(d.generation_needed(now), None);
        for i in 0..CANDIDATE_POOL_SIZE {
            assert!(d.veto_candidate(101, LU, i as u8));
        }
        assert_eq!(d.generation_needed(now), Some(101));
        d.generate_candidate(101).unwrap();
        assert_eq!(d.generation_needed(now), None);
        assert!(!d.veto_candidate(101, LU, 9));
        assert!(!d.veto_candidate(101, "other", 0));

        let views = d.candidate_views(101);
        assert_eq!(views.len(), 4);
        assert!(views.iter().all(|v| v.game_id == LU));
        assert_eq!(views.iter().filter(|v| v.vetoed).count(), 3);
    }

    // Every veto asks for one more candidate, so without a ceiling a pool grows without bound and
    // the `u8` index wraps past 255 onto a different puzzle
    #[test]
    fn candidate_pool_has_a_ceiling() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        for i in 0..MAX_CANDIDATE_POOL {
            assert_eq!(d.generation_needed(now), Some(100));
            assert_eq!(d.generate_candidate(100).unwrap(), i as u8);
            assert!(d.veto_candidate(100, LU, i as u8));
        }
        // Today is given up on rather than generated forever; tomorrow still gets its pool
        assert_eq!(d.generation_needed(now), Some(101));
        assert!(d.generate_candidate(100).is_none());
        assert_eq!(pool(&d, 100).len(), MAX_CANDIDATE_POOL);

        // And the same ceiling on a future day, once its pool is full and all of it vetoed
        while d.generation_needed(now) == Some(101) {
            let index = d.generate_candidate(101).unwrap();
            assert!(d.veto_candidate(101, LU, index));
        }
        assert_eq!(pool(&d, 101).len(), MAX_CANDIDATE_POOL);
    }

    #[test]
    fn two_game_schedule_generates_per_weekday() {
        let mut d = data();
        // Monday 7x7, Tuesday 8x8: both light_up, different params per weekday
        d.schedule[0].width = 7;
        d.schedule[0].height = 7;
        d.schedule[1].width = 8;
        d.schedule[1].height = 8;
        let monday = 102; // weekday(102) == 0
        let tuesday = 103;
        assert_eq!(weekday(monday), 0);
        assert_eq!(weekday(tuesday), 1);

        d.generate_candidate(monday).unwrap();
        d.generate_candidate(tuesday).unwrap();
        let mon = &pool(&d, monday)[0].puzzle;
        let tue = &pool(&d, tuesday)[0].puzzle;
        assert_eq!(mon.game_id, LU);
        assert_eq!(tue.game_id, LU);
        assert_eq!(mon.description[1], 7);
        assert_eq!(tue.description[1], 8);

        let now = monday as u64 * DAY_IN_MS + 1;
        assert!(d.ensure_puzzles(now));
        assert_eq!(d.current_puzzles(now)[0].description[1], 7);
        let now = tuesday as u64 * DAY_IN_MS + 1;
        assert!(d.ensure_puzzles(now));
        assert_eq!(d.current_puzzles(now)[0].description[1], 8);
    }

    /// Simulates the generate_candidates timer callbacks until today's puzzle ships
    fn run_generation(d: &mut Data, now: TimestampMillis) {
        while let Some(number) = d.generation_needed(now) {
            d.generate_candidate(number).unwrap();
            if d.ensure_puzzles(now) {
                break;
            }
        }
    }

    #[test]
    fn regenerate_today_forces_a_game_for_today_only() {
        let mut d = data();
        d.schedule = default_schedule();
        let monday = 102;
        assert_eq!(weekday(monday), 0);
        let now = monday as u64 * DAY_IN_MS + 1;

        run_generation(&mut d, now);
        assert_eq!(d.current_puzzles(now)[0].game_id, LU);

        d.regenerate_today(Some(tents::GAME_ID.to_string()), now).unwrap();
        assert!(!d.puzzles.contains_key(&monday));
        assert!(!d.candidates.contains_key(&monday));
        assert_eq!(d.generation_needed(now), Some(monday));

        run_generation(&mut d, now);
        let current = d.current_puzzles(now);
        assert_eq!(current.len(), 1);
        assert_eq!(current[0].game_id, tents::GAME_ID);
        assert_eq!(current[0].description[1], 8); // Tuesday's tents entry
        assert_eq!(current[0].number, monday);
        assert!(!d.candidates.contains_key(&monday));

        // Tomorrow still follows the schedule
        assert_eq!(d.generation_needed(now), Some(monday + 1));
        d.generate_candidate(monday + 1).unwrap();
        assert_eq!(d.candidates[&(monday + 1)].keys().next().unwrap(), tents::GAME_ID);
        assert_eq!(d.params_for(monday + 7).game_id, LU);

        // The override goes with the day
        d.prune(now + DAY_IN_MS);
        assert!(d.regeneration.is_none());
    }

    #[test]
    fn regenerate_today_replaces_same_game_with_a_different_puzzle() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        run_generation(&mut d, now);
        let first = d.puzzles[&100][LU].description.clone();

        d.regenerate_today(None, now).unwrap();
        run_generation(&mut d, now);
        let second = d.puzzles[&100][LU].description.clone();
        assert_ne!(first, second);
        assert_eq!(d.regeneration.as_ref().unwrap().attempt, 1);

        d.regenerate_today(None, now).unwrap();
        run_generation(&mut d, now);
        let third = d.puzzles[&100][LU].description.clone();
        assert_ne!(second, third);
        assert_eq!(d.regeneration.as_ref().unwrap().attempt, 2);

        // A game that isn't in the schedule at all gets the default params
        d.regenerate_today(Some(loopy::GAME_ID.to_string()), now).unwrap();
        run_generation(&mut d, now);
        let current = d.current_puzzles(now);
        assert_eq!(current[0].game_id, loopy::GAME_ID);
        assert_eq!(current[0].description[1], 6);

        assert!(d.regenerate_today(Some("sudoku".to_string()), now).is_err());
    }

    #[test]
    fn puzzles_carry_config_and_game_config() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        d.generate_candidate(100).unwrap();
        d.generate_candidate(101).unwrap();
        d.ensure_puzzles(now);

        let config = DailyPuzzleConfig {
            enabled: true,
            ..Default::default()
        };
        d.set_config(config.clone());
        assert_eq!(d.puzzles[&100][LU].config, config);
        assert_eq!(pool(&d, 101)[0].puzzle.config, config);

        let game_config = GameConfig {
            hint_prices: vec![5, 10],
            max_hints: 2,
        };
        d.set_game_config(LU.to_string(), game_config.clone());
        assert_eq!(d.puzzles[&100][LU].game_config, game_config);
        assert_eq!(pool(&d, 101)[0].puzzle.game_config, game_config);
        assert_eq!(d.game_config_for(LU), game_config);
        assert_eq!(d.game_config_for("other"), GameConfig::default());

        // New candidates pick up the current game config
        d.generate_candidate(101).unwrap();
        assert_eq!(pool(&d, 101)[1].puzzle.game_config, game_config);
        assert_eq!(d.puzzles[&100][LU].public().hint_prices, vec![5, 10]);
    }

    #[test]
    fn results_upsert_and_prune() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        d.upsert_results(vec![result(100, 1), result(100, 2), result(69, 3), result(70, 4)], now);
        assert_eq!(d.results.len(), 3); // 69 is older than 30 days
        let mut updated = result(100, 1);
        updated.solve_time_ms = 5;
        d.upsert_results(vec![updated], now);
        assert_eq!(d.results.len(), 3);
        assert_eq!(d.results[&(100, LU.to_string(), user(1))].solve_time_ms, 5);

        // A different game for the same user and number is its own row
        let mut other = result(100, 1);
        other.game_id = "other".to_string();
        d.upsert_results(vec![other], now);
        assert_eq!(d.results.len(), 4);

        d.prune(now + DAY_IN_MS);
        assert_eq!(d.results.len(), 3); // 70 fell out of the window

        let aggregates = d.aggregates(now);
        assert_eq!(aggregates.len(), 2);
        assert_eq!(aggregates[0].number, 100);
        assert_eq!(aggregates[0].game_id, LU);
        assert_eq!(aggregates[0].solves, 2);
        assert_eq!(aggregates[0].median_solve_ms, (5 + 2000) / 2);
        assert_eq!(aggregates[0].mean_hints, 1.5);
        assert_eq!(aggregates[1].game_id, "other");
        assert_eq!(aggregates[1].solves, 1);
    }

    #[test]
    fn config_and_schedule_validation() {
        assert!(validate_config(&DailyPuzzleConfig::default()).is_ok());
        let config = DailyPuzzleConfig {
            reward_by_streak: vec![],
            ..Default::default()
        };
        assert!(validate_config(&config).is_err());
        let config = DailyPuzzleConfig {
            max_submits: 0,
            ..Default::default()
        };
        assert!(validate_config(&config).is_err());

        assert!(validate_game_config(&GameConfig::default()).is_ok());
        let game_config = GameConfig {
            hint_prices: vec![],
            ..Default::default()
        };
        assert!(validate_game_config(&game_config).is_err());
        let game_config = GameConfig {
            hint_prices: vec![0, 1, 2, 3],
            ..Default::default()
        };
        assert!(validate_game_config(&game_config).is_err());
        // Upgrades are priced at the difference, so a flat or descending table hands over the
        // conclusions for nothing
        for prices in [vec![200, 75, 25], vec![100, 100, 100], vec![25, 75, 75]] {
            let game_config = GameConfig {
                hint_prices: prices,
                ..Default::default()
            };
            assert!(validate_game_config(&game_config).is_err());
        }
        let game_config = GameConfig {
            hint_prices: vec![0, 1, 2],
            ..Default::default()
        };
        assert!(validate_game_config(&game_config).is_ok());
        let game_config = GameConfig {
            max_hints: 0,
            ..Default::default()
        };
        assert!(validate_game_config(&game_config).is_err());
        let game_config = GameConfig {
            max_hints: 11,
            ..Default::default()
        };
        assert!(validate_game_config(&game_config).is_err());

        assert!(validate_schedule(&default_schedule()).is_ok());
        assert!(validate_schedule(&test_schedule()).is_ok());
        assert!(validate_schedule(&default_schedule()[..6]).is_err());
        let mut schedule = default_schedule();
        schedule[0].width = 4;
        assert!(validate_schedule(&schedule).is_err());
        let mut schedule = default_schedule();
        schedule[0].height = 15;
        assert!(validate_schedule(&schedule).is_err());
        let mut schedule = default_schedule();
        schedule[0].tier = 2;
        assert!(validate_schedule(&schedule).is_err());
        let mut schedule = default_schedule();
        schedule[0].black_pct = 61;
        assert!(validate_schedule(&schedule).is_err());
        // black_pct is a light_up knob; other games accept any value
        let mut schedule = default_schedule();
        schedule[1].black_pct = 0;
        schedule[2].black_pct = 255;
        assert!(validate_schedule(&schedule).is_ok());
    }

    #[test]
    fn schedule_with_unknown_game_id_is_rejected() {
        let mut schedule = default_schedule();
        schedule[3].game_id = "sudoku".to_string();
        let error = validate_schedule(&schedule).unwrap_err();
        assert!(error.contains("entry 3"), "{error}");
        assert!(error.contains("sudoku"), "{error}");

        // And the generator refuses it too, rather than producing a light_up puzzle
        let mut d = data();
        d.schedule[weekday(100)].game_id = "sudoku".to_string();
        assert_eq!(d.generate_candidate(100), None);
        assert!(d.candidates.is_empty());
    }

    #[test]
    fn data_round_trips_through_msgpack() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        d.generate_candidate(100).unwrap();
        d.ensure_puzzles(now);
        d.generate_candidate(101).unwrap();
        d.veto_candidate(101, LU, 0);
        d.upsert_results(vec![result(100, 1), result(99, 2)], now);
        d.local_user_indexes.insert(Principal::from_slice(&[7]));
        d.pending_pushes.insert(Principal::from_slice(&[7]));

        let bytes = msgpack::serialize_to_vec(&d).unwrap();
        let restored: Data = msgpack::deserialize(bytes.as_slice()).unwrap();

        assert_eq!(restored.master_seed, d.master_seed);
        assert_eq!(restored.puzzles[&100][LU].description, d.puzzles[&100][LU].description);
        assert_eq!(restored.puzzles[&100][LU].hints, d.puzzles[&100][LU].hints);
        assert_eq!(restored.puzzles[&100][LU].game_config, d.puzzles[&100][LU].game_config);
        assert!(pool(&restored, 101)[0].vetoed);
        assert_eq!(restored.results.len(), 2);
        assert_eq!(restored.results[&(100, LU.to_string(), user(1))], result(100, 1));
        assert_eq!(restored.local_user_indexes, d.local_user_indexes);
        assert_eq!(restored.pending_pushes, d.pending_pushes);
        assert_eq!(restored.schedule, d.schedule);
        assert_eq!(restored.game_configs, d.game_configs);
    }

    #[test]
    fn puzzles_history_is_capped() {
        let mut d = data();
        for n in 0..20u32 {
            d.generate_candidate(n).unwrap();
            d.ensure_puzzles(n as u64 * DAY_IN_MS);
        }
        assert_eq!(d.puzzles.len(), PUZZLES_TO_KEEP);
        assert_eq!(*d.puzzles.keys().next().unwrap(), 20 - PUZZLES_TO_KEEP as u32);
    }
}
