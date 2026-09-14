use crate::model::schedule::{PUZZLES_TO_KEEP, RESULTS_RETENTION_DAYS, forced_params, schedule, scheduled};
use crate::model::seed::candidate_seed;
use candid::Principal;
use canister_state_macros::canister_state;
use constants::DAY_IN_MS;
use daily_puzzle_canister::{CandidateView, PuzzleParams};
use puzzle_core::GenerateError;
use serde::{Deserialize, Deserializer, Serialize};
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
/// generator produces, and the answer to that is `regenerate_today` or a rota change, not
/// another candidate.
pub const MAX_CANDIDATE_POOL: usize = 32;

/// How many seeds a number may burn through before the generation job gives up for the day. Each
/// failure salts the next seed, so the day only stops once this many distinct seeds have all found
/// nothing, which means the parameters are at a limit rather than the seed being unlucky.
pub const MAX_GENERATION_FAILURES: u32 = 20;

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
            config: self.data.config(),
            game_config: GameConfig::default(),
            schedule: schedule().to_vec(),
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
            generation_failures: self.data.generation_failures.clone(),
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

/// Why `generate_candidate` produced nothing.
#[derive(Debug, PartialEq, Eq)]
pub enum GenerationFailure {
    /// This seed found nothing; another may do better.
    Exhausted,
    /// Nothing another attempt can fix: the scheduled game has no generator, its parameters are
    /// impossible for any seed, or the pool is already at its ceiling.
    Permanent,
}

/// A pin on a number's parameters: `params` replace the rota entry for `number`, and `attempt`
/// salts its seeds so each regeneration produces a different puzzle. Set by `regenerate_today`.
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
    /// The launch / kill switch: the only series value set at run time. Everything else in the
    /// config is a constant of the build (#9357). Read from the `config` map a pre-#9357 build
    /// stored, so an upgrade does not switch the game off.
    #[serde(default, alias = "config", deserialize_with = "enabled_from_flag_or_legacy_config")]
    pub enabled: bool,
    pub puzzles: BTreeMap<PuzzleNumber, BTreeMap<GameId, DailyPuzzle>>,
    pub candidates: BTreeMap<PuzzleNumber, BTreeMap<GameId, Vec<Candidate>>>,
    #[serde(default)]
    pub regeneration: Option<Regeneration>,
    /// Seeds that found nothing, per number. Salts the next seed so a retry is a different puzzle
    /// attempt rather than the one that just failed, and caps how many are tried.
    #[serde(default)]
    pub generation_failures: BTreeMap<PuzzleNumber, u32>,
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
        test_mode: bool,
    ) -> Data {
        Data {
            registry_canister_id,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            rng_seed: [0; 32],
            master_seed: 0,
            enabled: false,
            puzzles: BTreeMap::new(),
            candidates: BTreeMap::new(),
            regeneration: None,
            generation_failures: BTreeMap::new(),
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

    /// The series config as pushed with every puzzle: the constants plus the enabled flag.
    pub fn config(&self) -> DailyPuzzleConfig {
        DailyPuzzleConfig {
            enabled: self.enabled,
            ..DailyPuzzleConfig::default()
        }
    }

    /// The rota entry for `number`'s weekday, unless `regenerate_today` overrode that number.
    pub fn params_for(&self, number: PuzzleNumber) -> PuzzleParams {
        self.regeneration
            .as_ref()
            .filter(|r| r.number == number)
            .map_or_else(|| scheduled(number), |r| r.params.clone())
    }

    /// The seed salt for `number`: one step per `regenerate_today` and one per failed generation,
    /// packed so the two cannot land on a salt the other has already tried.
    fn attempt_for(&self, number: PuzzleNumber) -> u32 {
        self.regenerations_for(number)
            .saturating_mul(MAX_GENERATION_FAILURES + 1)
            .saturating_add(self.failures_for(number))
    }

    fn regenerations_for(&self, number: PuzzleNumber) -> u32 {
        self.regeneration
            .as_ref()
            .filter(|r| r.number == number)
            .map_or(0, |r| r.attempt)
    }

    pub fn failures_for(&self, number: PuzzleNumber) -> u32 {
        self.generation_failures.get(&number).copied().unwrap_or(0)
    }

    /// Records a seed that found nothing. Returns false once the number has used up its attempts.
    pub fn record_generation_failure(&mut self, number: PuzzleNumber) -> bool {
        let failures = self.generation_failures.entry(number).or_default();
        *failures = failures.saturating_add(1);
        *failures < MAX_GENERATION_FAILURES
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
        // A day that has used up its attempts is skipped rather than answered first, so a stuck
        // today does not also stop tomorrow's pool being built
        if !self.has_puzzle(current)
            && !self.has_unvetoed_candidate(current, game_id)
            && self.candidate_pool(current, game_id).map_or(0, |p| p.len()) < MAX_CANDIDATE_POOL
            && self.failures_for(current) < MAX_GENERATION_FAILURES
        {
            return Some(current);
        }
        let next = current + 1;
        let game_id = &self.params_for(next).game_id;
        // The same guard as today's: an exhausted number is not answered, or every trigger of the
        // job would run one more full generation for it and log "giving up" again
        if !self.has_puzzle(next) && self.failures_for(next) < MAX_GENERATION_FAILURES {
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
    /// game's pool. Deterministic given `master_seed`, the schedule, the number, the index and
    /// the number's attempt salt.
    pub fn generate_candidate(&mut self, number: PuzzleNumber) -> Result<u8, GenerationFailure> {
        let params = self.params_for(number);
        let index = self.candidate_pool(number, &params.game_id).map_or(0, |p| p.len());
        // Keeps the `u8` index below honest whatever the caller asked for
        if index >= MAX_CANDIDATE_POOL {
            return Err(GenerationFailure::Permanent);
        }
        let seed = candidate_seed(
            self.master_seed,
            number,
            &params.game_id,
            index as u64,
            self.attempt_for(number),
        );
        let generated = match generate(&params, seed) {
            Some(Ok(generated)) => generated,
            // The parameters are legal and another seed may still work
            Some(Err(GenerateError::Exhausted { .. })) => return Err(GenerationFailure::Exhausted),
            // The schedule entry is wrong, or names a game with no generator: no seed fixes either
            Some(Err(GenerateError::InvalidParams(_))) | None => return Err(GenerationFailure::Permanent),
        };
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
            config: self.config(),
            game_config: GameConfig::default(),
        };
        self.candidates
            .entry(number)
            .or_default()
            .entry(params.game_id)
            .or_default()
            .push(Candidate { puzzle, vetoed: false });
        Ok(index as u8)
    }

    /// Ships today's scheduled puzzle from its candidate pool if it hasn't shipped yet, then
    /// prunes old state. Returns true when a puzzle was promoted (the callers push on that).
    ///
    /// Every path that ends in a push runs through here (upgrade, rollover, generation), so this
    /// is also where every held puzzle is restamped with this build's constants: a release that
    /// changes a number reaches the local user indexes on its first push with no operator call
    /// (#9357 invariant 2).
    pub fn ensure_puzzles(&mut self, now: TimestampMillis) -> bool {
        self.stamp_config();
        let current = Self::number_for(now);
        let game_id = self.params_for(current).game_id.clone();
        let mut promoted = false;
        if !self.has_puzzle(current)
            && let Some(pool) = self.candidate_pool(current, &game_id)
            && let Some(candidate) = pool.iter().find(|c| !c.vetoed)
        {
            let puzzle = candidate.puzzle.clone();
            self.puzzles.entry(current).or_default().insert(game_id, puzzle);
            self.candidates.remove(&current);
            promoted = true;
        }
        self.prune(now);
        promoted
    }

    /// Drops today's puzzle(s) and candidate pool and points today at `game_id` (or the rota when
    /// None) with a fresh seed salt, so the generation job builds and ships a new one.
    pub fn regenerate_today(&mut self, game_id: Option<GameId>, now: TimestampMillis) -> Result<(), String> {
        let current = Self::number_for(now);
        let params = match game_id {
            Some(game_id) => forced_params(&game_id).ok_or(format!("unknown game_id '{game_id}'"))?,
            None => scheduled(current),
        };
        let attempt = self.regenerations_for(current) + 1;
        self.regeneration = Some(Regeneration {
            number: current,
            params,
            attempt,
        });
        self.puzzles.remove(&current);
        self.candidates.remove(&current);
        // A fresh run of attempts: the salt already moved with `attempt`, so none of them can
        // land on a seed the failed run tried. Left in place, a day that had given up would get
        // one seed per regeneration and give up again.
        self.generation_failures.remove(&current);
        Ok(())
    }

    pub fn prune(&mut self, now: TimestampMillis) {
        let current = Self::number_for(now);
        self.candidates.retain(|n, _| *n >= current);
        self.generation_failures.retain(|n, _| *n >= current);
        if self.regeneration.as_ref().is_some_and(|r| r.number < current) {
            self.regeneration = None;
        }
        while self.puzzles.len() > PUZZLES_TO_KEEP {
            self.puzzles.pop_first();
        }
        let cutoff = current.saturating_sub(RESULTS_RETENTION_DAYS);
        self.results.retain(|(n, _, _), _| *n >= cutoff);
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        self.stamp_config();
    }

    /// Writes the current config onto every puzzle and candidate held, so what is pushed and
    /// served is this build's constants plus the current enabled flag, whatever the puzzle was
    /// generated under.
    fn stamp_config(&mut self) {
        let config = self.config();
        for puzzle in self.puzzles.values_mut().flat_map(|games| games.values_mut()).chain(
            self.candidates
                .values_mut()
                .flat_map(|games| games.values_mut())
                .flatten()
                .map(|c| &mut c.puzzle),
        ) {
            puzzle.config = config.clone();
            puzzle.game_config = GameConfig::default();
        }
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

// A pre-#9357 build stored the whole config under `config`; only its flag carries over.
fn enabled_from_flag_or_legacy_config<'de, D: Deserializer<'de>>(deserializer: D) -> Result<bool, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Stored {
        Flag(bool),
        LegacyConfig { enabled: bool },
    }
    Ok(match Stored::deserialize(deserializer)? {
        Stored::Flag(enabled) | Stored::LegacyConfig { enabled } => enabled,
    })
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
/// nothing and another might. The error comes back so the caller can tell those apart: the first
/// stops the day, the second salts the seed and tries again.
macro_rules! into_generated {
    ($game_id:expr, $generated:expr) => {{
        let generated = match $generated {
            Ok(generated) => generated,
            Err(error) => {
                error!(game_id = $game_id, ?error, "Puzzle generation failed");
                return Some(Err(error));
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
fn generate(params: &PuzzleParams, seed: u64) -> Option<Result<Generated, GenerateError>> {
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
    Some(Ok(generated))
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
    pub game_config: GameConfig,
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
    /// Seeds that found nothing, per number. A number sitting at `MAX_GENERATION_FAILURES` has
    /// given up for the day and needs `regenerate_today`.
    pub generation_failures: BTreeMap<PuzzleNumber, u32>,
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
    use crate::model::schedule::launch_checks::{validate_config, validate_game_config, validate_schedule};
    use crate::model::schedule::{generators, weekday};
    use crate::model::seed::puzzle_seed;

    const LU: &str = light_up::GAME_ID;
    /// Numbers on the rota's Monday (light_up 7x7) and Tuesday (tents 8x8), so tests generate
    /// small easy boards
    const MONDAY: PuzzleNumber = 102;
    const TUESDAY: PuzzleNumber = 103;

    fn data() -> Data {
        let mut data = Data::new(Principal::anonymous(), Principal::anonymous(), Principal::anonymous(), true);
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
        // Every rota entry, plus one forced entry per registered generator so a game the rota
        // doesn't name (loopy, benched for being far harder than the rest) is still proved to
        // generate and to have usable default params.
        let forced = generators()
            .iter()
            .map(|g| forced_params(g).unwrap_or_else(|| panic!("no default params for {g}")));
        for (i, params) in schedule().into_iter().chain(forced).enumerate() {
            let generated = generate(&params, 1000 + i as u64)
                .unwrap_or_else(|| panic!("no generator for {}", params.game_id))
                .unwrap_or_else(|error| panic!("{} failed to generate: {error}", params.game_id));
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

        let mut unknown = scheduled(MONDAY);
        unknown.game_id = "sudoku".to_string();
        assert!(generate(&unknown, 1).is_none());
        assert!(forced_params("sudoku").is_none());
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

    /// The candidate pool of `number`'s rota game
    fn pool(d: &Data, number: PuzzleNumber) -> &Vec<Candidate> {
        &d.candidates[&number][&scheduled(number).game_id]
    }

    fn shipped(d: &Data, number: PuzzleNumber) -> &DailyPuzzle {
        &d.puzzles[&number][&scheduled(number).game_id]
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
        a.generate_candidate(MONDAY).unwrap();
        b.generate_candidate(MONDAY).unwrap();
        assert_eq!(pool(&a, MONDAY)[0].puzzle.description, pool(&b, MONDAY)[0].puzzle.description);
        assert_eq!(pool(&a, MONDAY)[0].puzzle.solution, pool(&b, MONDAY)[0].puzzle.solution);
    }

    #[test]
    fn weekday_mapping() {
        // 1970-01-01 (number 0) was a Thursday
        assert_eq!(weekday(0), 3);
        assert_eq!(weekday(4), 0);
        assert_eq!(weekday(10), 6);
        assert_eq!(weekday(11), 0);

        let d = data();
        assert_eq!(d.params_for(4).game_id, LU); // Monday
        assert_eq!(d.params_for(4).width, 7);
        assert_eq!(d.params_for(7).game_id, bridges::GAME_ID); // Thursday
        assert_eq!(d.params_for(9).game_id, tents::GAME_ID); // Saturday tricky
        assert_eq!(d.params_for(9).tier, 1);
        assert_eq!(d.params_for(10).game_id, LU); // Sunday tricky
        assert_eq!(d.params_for(10).width, 10);
        assert_eq!(weekday(MONDAY), 0);
        assert_eq!(weekday(TUESDAY), 1);
    }

    #[test]
    fn ensure_puzzles_picks_first_non_vetoed_candidate() {
        let mut d = data();
        let now = MONDAY as u64 * DAY_IN_MS + 1;
        assert_eq!(d.generation_needed(now), Some(MONDAY));
        d.generate_candidate(MONDAY).unwrap();
        d.generate_candidate(MONDAY).unwrap();
        d.generate_candidate(MONDAY).unwrap();
        assert!(d.veto_candidate(MONDAY, LU, 0));
        let expected = pool(&d, MONDAY)[1].puzzle.description.clone();

        assert!(d.ensure_puzzles(now));
        assert_eq!(shipped(&d, MONDAY).description, expected);
        assert_eq!(d.current_puzzles(now).len(), 1);
        assert!(!d.candidates.contains_key(&MONDAY));
        // Tomorrow's pool is now the outstanding work
        assert_eq!(d.generation_needed(now), Some(TUESDAY));
    }

    #[test]
    fn ensure_puzzles_generates_new_candidate_when_all_vetoed() {
        let mut d = data();
        let now = MONDAY as u64 * DAY_IN_MS + 1;
        d.generate_candidate(MONDAY).unwrap();
        assert!(d.veto_candidate(MONDAY, LU, 0));
        assert!(!d.ensure_puzzles(now));
        assert!(!d.puzzles.contains_key(&MONDAY));
        assert!(d.current_puzzles(now).is_empty());
        assert_eq!(d.generation_needed(now), Some(MONDAY));

        let index = d.generate_candidate(MONDAY).unwrap();
        assert_eq!(index, 1);
        let expected = pool(&d, MONDAY)[1].puzzle.description.clone();
        assert!(d.ensure_puzzles(now));
        assert_eq!(shipped(&d, MONDAY).description, expected);
        assert!(!d.candidates.contains_key(&MONDAY));

        // Tomorrow: a full pool, all vetoed, needs exactly one more
        let tomorrow = tents::GAME_ID;
        for _ in 0..CANDIDATE_POOL_SIZE {
            d.generate_candidate(TUESDAY).unwrap();
        }
        assert_eq!(d.generation_needed(now), None);
        for i in 0..CANDIDATE_POOL_SIZE {
            assert!(d.veto_candidate(TUESDAY, tomorrow, i as u8));
        }
        assert_eq!(d.generation_needed(now), Some(TUESDAY));
        d.generate_candidate(TUESDAY).unwrap();
        assert_eq!(d.generation_needed(now), None);
        assert!(!d.veto_candidate(TUESDAY, tomorrow, 9));
        assert!(!d.veto_candidate(TUESDAY, "other", 0));

        let views = d.candidate_views(TUESDAY);
        assert_eq!(views.len(), 4);
        assert!(views.iter().all(|v| v.game_id == tomorrow));
        assert_eq!(views.iter().filter(|v| v.vetoed).count(), 3);
    }

    // Every veto asks for one more candidate, so without a ceiling a pool grows without bound and
    // the `u8` index wraps past 255 onto a different puzzle
    #[test]
    fn candidate_pool_has_a_ceiling() {
        let mut d = data();
        let now = MONDAY as u64 * DAY_IN_MS + 1;
        for i in 0..MAX_CANDIDATE_POOL {
            assert_eq!(d.generation_needed(now), Some(MONDAY));
            assert_eq!(d.generate_candidate(MONDAY).unwrap(), i as u8);
            assert!(d.veto_candidate(MONDAY, LU, i as u8));
        }
        // Today is given up on rather than generated forever; tomorrow still gets its pool
        assert_eq!(d.generation_needed(now), Some(TUESDAY));
        assert_eq!(d.generate_candidate(MONDAY), Err(GenerationFailure::Permanent));
        assert_eq!(pool(&d, MONDAY).len(), MAX_CANDIDATE_POOL);

        // And the same ceiling on a future day, once its pool is full and all of it vetoed
        while d.generation_needed(now) == Some(TUESDAY) {
            let index = d.generate_candidate(TUESDAY).unwrap();
            assert!(d.veto_candidate(TUESDAY, tents::GAME_ID, index));
        }
        assert_eq!(pool(&d, TUESDAY).len(), MAX_CANDIDATE_POOL);
    }

    #[test]
    fn rota_generates_per_weekday() {
        let mut d = data();
        // Monday and Sunday are both light_up, at different sizes and tiers
        let sunday = MONDAY + 6;
        assert_eq!(weekday(sunday), 6);
        d.generate_candidate(MONDAY).unwrap();
        d.generate_candidate(sunday).unwrap();
        let mon = &pool(&d, MONDAY)[0].puzzle;
        let sun = &pool(&d, sunday)[0].puzzle;
        assert_eq!(mon.game_id, LU);
        assert_eq!(sun.game_id, LU);
        assert_eq!(mon.description[1], 7);
        assert_eq!(sun.description[1], 10);
        assert_eq!(mon.tier, 0);
        assert_eq!(sun.tier, 1);

        let now = MONDAY as u64 * DAY_IN_MS + 1;
        assert!(d.ensure_puzzles(now));
        assert_eq!(d.current_puzzles(now)[0].description[1], 7);
        let now = sunday as u64 * DAY_IN_MS + 1;
        assert!(d.ensure_puzzles(now));
        assert_eq!(d.current_puzzles(now)[0].description[1], 10);
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
        let now = MONDAY as u64 * DAY_IN_MS + 1;

        run_generation(&mut d, now);
        assert_eq!(d.current_puzzles(now)[0].game_id, LU);

        d.regenerate_today(Some(tents::GAME_ID.to_string()), now).unwrap();
        assert!(!d.puzzles.contains_key(&MONDAY));
        assert!(!d.candidates.contains_key(&MONDAY));
        assert_eq!(d.generation_needed(now), Some(MONDAY));

        run_generation(&mut d, now);
        let current = d.current_puzzles(now);
        assert_eq!(current.len(), 1);
        assert_eq!(current[0].game_id, tents::GAME_ID);
        assert_eq!(current[0].description[1], 8); // Tuesday's tents entry
        assert_eq!(current[0].number, MONDAY);
        assert!(!d.candidates.contains_key(&MONDAY));

        // Tomorrow still follows the rota
        assert_eq!(d.generation_needed(now), Some(TUESDAY));
        d.generate_candidate(TUESDAY).unwrap();
        assert_eq!(d.candidates[&TUESDAY].keys().next().unwrap(), tents::GAME_ID);
        assert_eq!(d.params_for(MONDAY + 7).game_id, LU);

        // The override goes with the day
        d.prune(now + DAY_IN_MS);
        assert!(d.regeneration.is_none());
    }

    // Nothing else moves the seed, so a number whose generation failed would otherwise regenerate
    // from the identical seed every time the rollover timer ran, and fail the same way, until an
    // operator noticed. The failures salt it instead, and cap how many are tried.
    #[test]
    fn a_failed_generation_salts_the_next_seed_and_gives_up_eventually() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        let mut salts = vec![d.attempt_for(100)];
        for failures in 1..MAX_GENERATION_FAILURES {
            assert!(d.record_generation_failure(100));
            assert_eq!(d.failures_for(100), failures);
            salts.push(d.attempt_for(100));
        }
        // The last one is refused: the parameters are at a limit, not the seed unlucky
        assert!(!d.record_generation_failure(100));
        assert_eq!(salts.len(), MAX_GENERATION_FAILURES as usize);

        // A regeneration cannot land on a salt the failures have already used
        d.regenerate_today(None, now).unwrap();
        assert!(!salts.contains(&d.attempt_for(100)));

        // And the counts go with the day
        d.prune(now + DAY_IN_MS);
        assert_eq!(d.failures_for(100), 0);
    }

    #[test]
    fn regenerate_today_replaces_same_game_with_a_different_puzzle() {
        let mut d = data();
        let now = MONDAY as u64 * DAY_IN_MS + 1;
        run_generation(&mut d, now);
        let first = shipped(&d, MONDAY).description.clone();

        d.regenerate_today(None, now).unwrap();
        run_generation(&mut d, now);
        let second = shipped(&d, MONDAY).description.clone();
        assert_ne!(first, second);
        assert_eq!(d.regeneration.as_ref().unwrap().attempt, 1);

        d.regenerate_today(None, now).unwrap();
        run_generation(&mut d, now);
        let third = shipped(&d, MONDAY).description.clone();
        assert_ne!(second, third);
        assert_eq!(d.regeneration.as_ref().unwrap().attempt, 2);

        // A game the rota doesn't name gets its default params
        d.regenerate_today(Some(loopy::GAME_ID.to_string()), now).unwrap();
        run_generation(&mut d, now);
        let current = d.current_puzzles(now);
        assert_eq!(current[0].game_id, loopy::GAME_ID);
        assert_eq!(current[0].description[1], 6);

        assert!(d.regenerate_today(Some("sudoku".to_string()), now).is_err());
    }

    // #9357 invariants 1 and 2. `enabled` is the only value `set_enabled` moves, and every puzzle
    // and candidate held is restamped with this build's constants, both on the flag flip and on
    // the upgrade path (`ensure_puzzles`), so a release that changes a number reaches the local
    // user indexes on the next push with no operator call.
    #[test]
    fn puzzles_carry_the_constant_config_and_the_enabled_flag() {
        let mut d = data();
        let now = MONDAY as u64 * DAY_IN_MS + 1;
        d.generate_candidate(MONDAY).unwrap();
        d.generate_candidate(TUESDAY).unwrap();
        d.ensure_puzzles(now);

        let constants = DailyPuzzleConfig::default();
        assert!(!constants.enabled);
        assert_eq!(shipped(&d, MONDAY).config, constants);
        assert_eq!(pool(&d, TUESDAY)[0].puzzle.config, constants);
        assert_eq!(shipped(&d, MONDAY).game_config, GameConfig::default());

        d.set_enabled(true);
        let enabled = DailyPuzzleConfig {
            enabled: true,
            ..constants.clone()
        };
        assert_eq!(d.config(), enabled);
        assert_eq!(shipped(&d, MONDAY).config, enabled);
        assert_eq!(pool(&d, TUESDAY)[0].puzzle.config, enabled);
        assert!(shipped(&d, MONDAY).public().enabled);

        // New candidates pick up the current flag
        d.generate_candidate(TUESDAY).unwrap();
        assert_eq!(pool(&d, TUESDAY)[1].puzzle.config, enabled);

        // A puzzle generated under an older build's numbers is brought up to this build's by
        // the ship step every push path runs through, not by a call something has to remember
        let stale = DailyPuzzleConfig {
            entry_fee: 1,
            reward_by_streak: vec![1],
            ..enabled.clone()
        };
        d.puzzles.get_mut(&MONDAY).unwrap().get_mut(LU).unwrap().config = stale.clone();
        d.candidates.get_mut(&TUESDAY).unwrap().get_mut(tents::GAME_ID).unwrap()[0]
            .puzzle
            .config = stale;
        d.puzzles
            .get_mut(&MONDAY)
            .unwrap()
            .get_mut(LU)
            .unwrap()
            .game_config
            .hint_prices = vec![1];
        assert!(!d.ensure_puzzles(now), "nothing to promote, only to restamp");
        assert_eq!(shipped(&d, MONDAY).config, enabled);
        assert_eq!(pool(&d, TUESDAY)[0].puzzle.config, enabled);
        assert_eq!(shipped(&d, MONDAY).game_config, GameConfig::default());
        assert_eq!(shipped(&d, MONDAY).public().hint_prices, GameConfig::default().hint_prices);

        d.set_enabled(false);
        assert!(!shipped(&d, MONDAY).config.enabled);
        assert!(!pool(&d, TUESDAY)[1].puzzle.config.enabled);
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

    /// The most a daily claim pays, at a 365-day streak. Mirrors `chit_for_streak` in the user
    /// canister's `claim_daily_chit`.
    const MAX_DAILY_CLAIM: u32 = 1000;

    // #9357 acceptance: the launch numbers are constants, and the checks that used to guard the
    // setters hold over them. Solve rewards stay below the daily claim, so the puzzle is a
    // supplement to that habit and not a replacement; the entry fee stays below the streak-zero
    // reward, so a first solve is never a net loss; and the entry fee plus three full hints
    // costs more than the top reward, so hinting all the way through never pays.
    #[test]
    fn launch_numbers_are_constants_that_pass_the_config_checks() {
        let config = DailyPuzzleConfig::default();
        let game_config = GameConfig::default();
        validate_config(&config).unwrap();
        validate_game_config(&game_config).unwrap();
        validate_schedule(&schedule()).unwrap();

        let max_reward = *config.reward_by_streak.iter().max().unwrap();
        assert!(max_reward < MAX_DAILY_CLAIM, "{max_reward} vs {MAX_DAILY_CLAIM}");
        assert!(config.entry_fee < config.reward_by_streak[0]);
        let full_hint = *game_config.hint_prices.last().unwrap();
        assert!(config.entry_fee + 3 * full_hint > max_reward);
        assert_eq!(game_config.max_hints, 3);

        // What the canister serves is exactly these, plus the flag
        let mut d = data();
        assert_eq!(d.config(), config);
        d.set_enabled(true);
        assert_eq!(
            d.config(),
            DailyPuzzleConfig {
                enabled: true,
                ..config.clone()
            }
        );
    }

    // The checks above must still bite, or passing them proves nothing
    #[test]
    fn config_checks_reject_bad_numbers() {
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
        let config = DailyPuzzleConfig {
            entry_fee: 100_001,
            ..Default::default()
        };
        assert!(validate_config(&config).is_err());

        // Upgrades are priced at the difference, so a flat or descending table hands over the
        // conclusions for nothing; a free level 1 is unmetered in CHIT and in free checks
        for prices in [
            vec![],
            vec![0, 1, 2, 3],
            vec![200, 75, 25],
            vec![100, 100, 100],
            vec![0, 1, 2],
        ] {
            let game_config = GameConfig {
                hint_prices: prices,
                ..Default::default()
            };
            assert!(validate_game_config(&game_config).is_err());
        }
        for max_hints in [0, 11] {
            let game_config = GameConfig {
                max_hints,
                ..Default::default()
            };
            assert!(validate_game_config(&game_config).is_err());
        }

        assert!(validate_schedule(&schedule()[..6]).is_err());
        for (i, mutate) in [
            (
                0,
                Box::new(|p: &mut PuzzleParams| p.width = 4) as Box<dyn Fn(&mut PuzzleParams)>,
            ),
            (0, Box::new(|p: &mut PuzzleParams| p.height = 15)),
            (0, Box::new(|p: &mut PuzzleParams| p.tier = 2)),
            (0, Box::new(|p: &mut PuzzleParams| p.black_pct = 61)),
            (3, Box::new(|p: &mut PuzzleParams| p.game_id = "sudoku".to_string())),
            (4, Box::new(|p: &mut PuzzleParams| p.width = 7)),
        ] {
            let mut schedule = schedule();
            mutate(&mut schedule[i]);
            let error = validate_schedule(&schedule).unwrap_err();
            assert!(error.contains(&format!("entry {i}")), "{error}");
        }
        // black_pct is a light_up knob; other games accept any value
        let mut schedule = schedule();
        schedule[1].black_pct = 0;
        schedule[2].black_pct = 255;
        assert!(validate_schedule(&schedule).is_ok());
    }

    #[test]
    fn data_round_trips_through_msgpack() {
        let mut d = data();
        let now = MONDAY as u64 * DAY_IN_MS + 1;
        d.generate_candidate(MONDAY).unwrap();
        d.ensure_puzzles(now);
        d.generate_candidate(TUESDAY).unwrap();
        d.veto_candidate(TUESDAY, tents::GAME_ID, 0);
        d.upsert_results(vec![result(MONDAY, 1), result(MONDAY - 1, 2)], now);
        d.local_user_indexes.insert(Principal::from_slice(&[7]));
        d.pending_pushes.insert(Principal::from_slice(&[7]));
        d.set_enabled(true);

        let bytes = msgpack::serialize_to_vec(&d).unwrap();
        let restored: Data = msgpack::deserialize(bytes.as_slice()).unwrap();

        assert_eq!(restored.master_seed, d.master_seed);
        assert!(restored.enabled);
        assert_eq!(shipped(&restored, MONDAY).description, shipped(&d, MONDAY).description);
        assert_eq!(shipped(&restored, MONDAY).hints, shipped(&d, MONDAY).hints);
        assert_eq!(shipped(&restored, MONDAY).game_config, shipped(&d, MONDAY).game_config);
        assert!(pool(&restored, TUESDAY)[0].vetoed);
        assert_eq!(restored.results.len(), 2);
        assert_eq!(restored.results[&(MONDAY, LU.to_string(), user(1))], result(MONDAY, 1));
        assert_eq!(restored.local_user_indexes, d.local_user_indexes);
        assert_eq!(restored.pending_pushes, d.pending_pushes);
    }

    // A pre-#9357 build stored the whole config, the game configs and the schedule. The flag is
    // read out of the stored config so the upgrade does not switch the game off; the rest is
    // dropped in favour of this build's constants.
    #[test]
    fn legacy_state_keeps_its_enabled_flag_and_drops_the_rest() {
        #[derive(Serialize)]
        struct Legacy {
            registry_canister_id: CanisterId,
            user_index_canister_id: CanisterId,
            cycles_dispenser_canister_id: CanisterId,
            rng_seed: [u8; 32],
            master_seed: u64,
            config: DailyPuzzleConfig,
            game_configs: BTreeMap<GameId, GameConfig>,
            schedule: Vec<PuzzleParams>,
            puzzles: BTreeMap<PuzzleNumber, BTreeMap<GameId, DailyPuzzle>>,
            candidates: BTreeMap<PuzzleNumber, BTreeMap<GameId, Vec<Candidate>>>,
            results: BTreeMap<(PuzzleNumber, GameId, UserId), DailyPuzzleResult>,
            local_user_indexes: HashSet<CanisterId>,
            pending_pushes: HashSet<CanisterId>,
            last_registry_refresh: TimestampMillis,
            test_mode: bool,
        }
        let now = MONDAY as u64 * DAY_IN_MS + 1;
        let mut held = data();
        held.generate_candidate(MONDAY).unwrap();
        held.ensure_puzzles(now);
        let mut stale = shipped(&held, MONDAY).clone();
        stale.config.entry_fee = 1;
        stale.game_config.hint_prices = vec![1];
        let legacy = |enabled| Legacy {
            registry_canister_id: Principal::anonymous(),
            user_index_canister_id: Principal::anonymous(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            rng_seed: [1; 32],
            master_seed: 9,
            config: DailyPuzzleConfig {
                enabled,
                entry_fee: 1,
                ..Default::default()
            },
            game_configs: BTreeMap::new(),
            schedule: vec![scheduled(MONDAY); 7],
            puzzles: BTreeMap::from([(MONDAY, BTreeMap::from([(LU.to_string(), stale.clone())]))]),
            candidates: BTreeMap::new(),
            results: BTreeMap::new(),
            local_user_indexes: HashSet::new(),
            pending_pushes: HashSet::new(),
            last_registry_refresh: 0,
            test_mode: true,
        };
        for enabled in [true, false] {
            let bytes = msgpack::serialize_to_vec(legacy(enabled)).unwrap();
            let mut restored: Data = msgpack::deserialize(bytes.as_slice()).unwrap();
            assert_eq!(restored.enabled, enabled);
            assert_eq!(restored.master_seed, 9);
            assert_eq!(restored.config().entry_fee, DailyPuzzleConfig::default().entry_fee);
            // The held puzzle carries the old build's numbers until the upgrade's ship step runs,
            // which `init_state` does before its push
            assert_eq!(shipped(&restored, MONDAY).config.entry_fee, 1);
            restored.ensure_puzzles(now);
            assert_eq!(shipped(&restored, MONDAY).config, restored.config());
            assert_eq!(shipped(&restored, MONDAY).config.enabled, enabled);
            assert_eq!(shipped(&restored, MONDAY).game_config, GameConfig::default());
        }
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

    // #9332 invariant 34. A day that has used up its generation attempts answered
    // `generation_needed` first, forever, so tomorrow's pool was never built either. And the
    // count survived a `regenerate_today`, so a day that had given up got one seed per
    // regeneration and gave up again.
    #[test]
    fn an_exhausted_day_is_skipped_and_gets_a_fresh_run_on_regenerate() {
        let mut d = data();
        let now = 100 * DAY_IN_MS + 1;
        assert_eq!(d.generation_needed(now), Some(100));

        while d.record_generation_failure(100) {}
        assert_eq!(d.failures_for(100), MAX_GENERATION_FAILURES);
        assert_eq!(
            d.generation_needed(now),
            Some(101),
            "an exhausted today must not block tomorrow"
        );

        d.regenerate_today(None, now).unwrap();
        assert_eq!(d.failures_for(100), 0);
        assert_eq!(d.generation_needed(now), Some(100));

        // Both exhausted: nothing to do until a regeneration or the rollover
        while d.record_generation_failure(100) {}
        while d.record_generation_failure(101) {}
        assert_eq!(d.generation_needed(now), None);
    }
}
