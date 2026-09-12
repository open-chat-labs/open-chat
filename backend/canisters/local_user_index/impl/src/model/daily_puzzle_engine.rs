use constants::{DAY_IN_MS, MINUTE_IN_MS};
use local_user_index_canister::daily_puzzle_fetch::FetchResult;
use local_user_index_canister::daily_puzzle_hint::HintResult;
use local_user_index_canister::daily_puzzle_start::StartResult;
use oc_error_codes::{OCError, OCErrorCode};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use types::{
    DailyPuzzle, DailyPuzzleResult, DailyPuzzleSolved, DailyPuzzleUserState, GameId, Milliseconds, OCResult, PuzzleHint,
    PuzzleNumber, ServedHint, TimestampMillis, UserId,
};

// How long a hint reservation may sit unresolved before the step goes back in the pool. The debit
// it waits on is a single c2c round trip, so nothing legitimate comes close; what this catches is
// the reservation left behind when the callback never runs at all.
const HINT_RESERVATION_TIMEOUT: Milliseconds = 5 * MINUTE_IN_MS;

// Pure state machine for the daily puzzles. No canister APIs: every method takes `now` and the
// endpoint files do the c2c calls between `prepare_*` and `commit_*`.
//
// CHIT idempotency keys, sent to the user canister with every debit or credit, are
// `{game_id}:{number}:entry`, `{game_id}:{number}:solve` and
// `{game_id}:{number}:hint:{step}:{level}`. They deliberately do not identify which puzzle was
// held for that number. A `regenerate_today` replaces the day's puzzle and drops the records made
// against the old one, so every call is made again: with the puzzle in the key, the replay would
// charge a second entry fee and, worse, pay a second full reward to someone who had already
// solved that day. Without it the user canister answers `AlreadyAdded`, which the endpoints treat
// as applied, so a regenerated day is a free restart and pays out once. Longest key in practice is
// around 26 bytes, well under the user canister's 64-byte limit.
// Every field defaults so a blob written by an older shape deserialises to an empty engine and the
// canister re-pulls. Fields whose shape changed were renamed rather than reused for that reason.
#[derive(Serialize, Deserialize, Default)]
pub struct DailyPuzzleEngine {
    // The puzzles for the current number, keyed by game
    #[serde(default)]
    puzzles: BTreeMap<GameId, DailyPuzzle>,
    #[serde(default)]
    number: Option<PuzzleNumber>,
    // Records for the puzzles currently held. Dropped per game when its puzzle is replaced, and
    // wholesale when the number changes.
    #[serde(default)]
    user_games: BTreeMap<UserId, BTreeMap<GameId, UserGame>>,
    // What each user has ever done, across every day. Streaks are series-level: a day counts
    // once however many games were solved on it.
    //
    // The one field here that is not re-pullable. Everything else above is scratch for the
    // current day and comes back from the daily canister; this is the only record that a user
    // ever played or solved anything, and no other canister holds it. So the
    // rename-on-shape-change rule above must never be applied to it: renaming it, or changing
    // its shape so an old blob defaults, resets every streak in the population and hands
    // `first_play_free` back to everyone. Migrate it in place or move it out of this struct,
    // never default it.
    #[serde(default)]
    history: BTreeMap<UserId, UserHistory>,
}

// Three numbers rather than the set of every day ever solved: the only things read back are the
// run ending at a given number and whether the user has played before, and both follow from
// these. A set would grow by an entry per solved day per user, forever, in a heap shared with
// every other user on the subnet.
#[derive(Serialize, Deserialize, Default)]
pub struct UserHistory {
    // The most recent puzzle number on which the user solved at least one game
    pub last_solved: Option<PuzzleNumber>,
    // Consecutive numbers solved ending at `last_solved`, so always at least 1 once it is set
    pub streak: u32,
    // Set when a record is first created for the user, not when they solve. `first_play_free`
    // hangs off this: gated on solving instead, a player who never solves plays free forever.
    pub ever_started: bool,
    // The puzzle number the free play was spent on, so that a `regenerate_today` for that day is
    // the free restart it claims to be rather than the one player's fee. See `entry_fee`. None on
    // blobs written before this existed, whose free play was spent on some earlier day.
    #[serde(default)]
    pub first_started: Option<PuzzleNumber>,
    // The game the free play was spent on. Without it the restart waiver reads "nothing of
    // today's is still held", which a second game on a day whose first game was regenerated also
    // satisfies, handing that game away free too.
    #[serde(default)]
    pub first_game: Option<GameId>,
}

#[derive(Serialize, Deserialize)]
pub struct UserGame {
    pub number: PuzzleNumber,
    pub started_at: TimestampMillis,
    pub entry_paid: bool,
    pub hints: Vec<HintEntry>,
    pub hint_steps_used: u8,
    pub grid: Vec<u8>,
    pub grid_saved_at: Option<TimestampMillis>,
    pub submits: u16,
    // Hint calls that served no paid hint. See `DailyPuzzleConfig::max_free_checks`.
    #[serde(default)]
    pub free_checks: u16,
    pub solved: Option<DailyPuzzleSolved>,
}

// A hint step the user has claimed. `served` holds only what has been paid for; the content of
// an outstanding reservation is not stored at all, because `daily_puzzle_fetch` is a query and
// would hand it back mid-debit - the whole answer, at level 3, for nothing.
#[derive(Serialize, Deserialize)]
pub struct HintEntry {
    // Index of the step in the generator's trace
    pub step: u16,
    // The hint as served at the highest level paid for, None while nothing has been paid yet
    pub served: Option<ServedHint>,
    // The level of an outstanding reservation. Recorded before the debit so calls that overlap
    // on the await cannot walk past `max_hints`, and cleared by `confirm_hint` / `release_hint`.
    pub pending_level: Option<u8>,
    // When `pending_level` was set, so `expire_reservations` can tell a debit still in flight from
    // one whose callback never ran
    #[serde(default)]
    pub pending_since: TimestampMillis,
}

pub enum StartPrepared {
    AlreadyStarted(StartResult),
    // The record exists by the time this is returned: the clock runs from the call rather than
    // from whenever the debit came back, and a puzzle swap during the debit cannot leave the user
    // charged with no game to play. `release_start` undoes it if the debit fails.
    Start { fee: u32, key: String, result: StartResult },
}

pub struct SubmitOutcome {
    pub solved: DailyPuzzleSolved,
    // None when the solve came in faster than `min_carded_solve_ms`. The solve is still recorded
    // and still paid: CHIT buys nothing, so a scripted solve only cheats itself. What it must not
    // do is enter the results index, which is what a shared card is verified against and what the
    // published median and mean are computed over. Those are the one part of this a cheat takes
    // from other players, so an impossible time earns no card and moves no aggregate.
    pub result: Option<DailyPuzzleResult>,
}

pub enum HintPrepared {
    // Free, not recorded: the user has a wrong cell
    Mistake(HintResult),
    // Already served at this level or higher: re-served free
    AlreadyServed(HintResult),
    // The step is already reserved against the user by the time this is returned, so the cap
    // cannot be walked past by calls that overlap on the debit's await. Only the reservation is
    // stored: the hint itself reaches state in `confirm_hint`, once it is paid for. The endpoint
    // calls exactly one of `confirm_hint` / `release_hint` with the same step and level.
    Serve {
        step: u16,
        level: u8,
        result: HintResult,
        price: u32,
        // The CHIT idempotency key for the debit
        key: String,
    },
}

pub struct DailyPuzzleSummary {
    pub games: Vec<GameId>,
    pub number: Option<PuzzleNumber>,
    pub enabled: bool,
}

#[derive(Serialize, Debug)]
pub struct DailyPuzzleEngineMetrics {
    pub games: Vec<GameId>,
    pub number: Option<PuzzleNumber>,
    pub enabled: bool,
    pub users_with_records: u32,
    pub users_who_have_solved: u64,
}

pub fn day_number(now: TimestampMillis) -> PuzzleNumber {
    (now / DAY_IN_MS) as PuzzleNumber
}

fn not_available() -> OCError {
    OCErrorCode::NotInitialized.with_message("not available")
}

/// The hint as the client may see it at `level`, withholding everything the player has not paid
/// for. Level 1 highlights the region the deduction looked at. Level 2 adds the technique, so the
/// client can render the sentence, and the keys that sentence points at. Level 3 adds the
/// conclusions, which are the answer.
///
/// `technique` 0 means withheld: no game's `Technique` enum uses 0, they all start at 1.
///
/// `target` is dropped below level 3 when it names a key the step concludes. In three of the six
/// games it always does (slant's forced square, tents' line rules, loopy's premature loop all set
/// `target` to the cells they fill), and sending it would hand over the level 3 answer at the
/// level 2 price. An empty `target` already means "paint the whole of `focus`", so the client
/// needs no new case. `focus` is never filtered: it is a region the player can usually
/// reconstruct from the rules, so punching the answer out of it would point straight at the
/// answer.
fn hint_at_level(hint: &PuzzleHint, level: u8) -> PuzzleHint {
    if level >= 3 {
        return hint.clone();
    }
    let concluded: BTreeSet<u16> = hint.conclusions.iter().map(|(k, _)| *k).collect();
    let target = hint.target.clone();
    PuzzleHint {
        technique: if level >= 2 { hint.technique } else { 0 },
        focus: hint.focus.clone(),
        target: if level >= 2 && !target.iter().any(|k| concluded.contains(k)) { target } else { Vec::new() },
        conclusions: Vec::new(),
    }
}

fn not_started() -> OCError {
    OCErrorCode::InvalidRequest.with_message("not started")
}

// The record exists but its entry fee is still in flight, so the game is not live yet. Retrying
// once the start call has returned is the right response, which is why this is not `not_started`.
fn entry_unpaid() -> OCError {
    OCErrorCode::InvalidRequest.with_message("entry not paid")
}

impl DailyPuzzleEngine {
    #[cfg(test)]
    fn puzzle(&self, game_id: &str) -> Option<&DailyPuzzle> {
        self.puzzles.get(game_id)
    }

    // Replaces the whole set. Puzzles for anything but the highest number in the batch are ignored.
    // User records are dropped for every game whose puzzle is not the one they were made against:
    // all of them when the number changes, otherwise those for games absent from the push and games
    // whose description differs from the one held (a `regenerate_today` for the same number).
    // History is never touched. Returns true if any record was dropped.
    //
    // An empty set is "I have nothing for the current number", which the daily canister answers
    // during the gap between `regenerate_today` dropping a puzzle and its replacement being
    // generated. Taken literally it would read as a day change and clear every puzzle and every
    // in-progress record, entry fees included, so it is a no-op here rather than at each caller.
    pub fn set_puzzles(&mut self, puzzles: Vec<DailyPuzzle>) -> bool {
        if puzzles.is_empty() {
            return false;
        }

        let number = puzzles.iter().map(|p| p.number).max();
        // Only ever advance. A push that carries an older number - a stale retry, or a restored
        // snapshot - would otherwise read as a day change and clear every in-progress record on
        // the subnet, entry fees included, until the clock caught up again.
        if let (Some(number), Some(held)) = (number, self.number)
            && number < held
        {
            return false;
        }
        let puzzles: BTreeMap<GameId, DailyPuzzle> = puzzles
            .into_iter()
            .filter(|p| Some(p.number) == number)
            .map(|p| (p.game_id.clone(), p))
            .collect();

        let dropped = if self.number != number {
            let any = self.user_games.values().any(|m| !m.is_empty());
            self.user_games.clear();
            any
        } else {
            let changed: Vec<&GameId> = self
                .puzzles
                .keys()
                .chain(puzzles.keys().filter(|g| !self.puzzles.contains_key(*g)))
                .filter(|g| match (self.puzzles.get(*g), puzzles.get(*g)) {
                    (Some(old), Some(new)) => old.description != new.description,
                    _ => true,
                })
                .collect();
            let mut any = false;
            if !changed.is_empty() {
                for games in self.user_games.values_mut() {
                    for g in &changed {
                        any |= games.remove(*g).is_some();
                    }
                }
                self.user_games.retain(|_, m| !m.is_empty());
            }
            any
        };

        self.number = number;
        self.puzzles = puzzles;
        dropped
    }

    pub fn entry_key(&self, game_id: &str, number: PuzzleNumber) -> String {
        format!("{game_id}:{number}:entry")
    }

    pub fn solve_key(&self, game_id: &str, number: PuzzleNumber) -> String {
        format!("{game_id}:{number}:solve")
    }

    pub fn hint_key(&self, game_id: &str, number: PuzzleNumber, step: u16, level: u8) -> String {
        format!("{game_id}:{number}:hint:{step}:{level}")
    }

    // True when there is no puzzle for the current day number, so a pull is worthwhile
    pub fn is_stale(&self, now: TimestampMillis) -> bool {
        self.number != Some(day_number(now))
    }

    pub fn fetch(&self, user_id: UserId, now: TimestampMillis) -> FetchResult {
        let (puzzles, states) = self.current(now).map(|p| (p.public(), self.user_state(user_id, p))).unzip();

        FetchResult { puzzles, states }
    }

    // Creates the record before the entry fee is debited. `release_start` removes it again if the
    // debit fails, so the fee and the game are never separated in either direction.
    pub fn reserve_start(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        expected_entry_fee: u32,
        now: TimestampMillis,
    ) -> OCResult<StartPrepared> {
        let puzzle = self.available(game_id, number, now)?;

        if let Some(record) = self.record(user_id, game_id, number) {
            return Ok(StartPrepared::AlreadyStarted(StartResult {
                started_at: record.started_at,
                state: self.user_state(user_id, puzzle),
                chit_balance: None,
                total_chit_earned: None,
            }));
        }

        let fee = self.entry_fee(user_id, puzzle);
        if fee != expected_entry_fee {
            return Err(OCErrorCode::PriceMismatch.into());
        }

        let key = self.entry_key(game_id, number);
        // Nothing owed is nothing outstanding, so a free first play is paid up from the start
        let result = self.create_record(user_id, game_id, number, now, fee == 0)?;

        Ok(StartPrepared::Start { fee, key, result })
    }

    fn create_record(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        started_at: TimestampMillis,
        entry_paid: bool,
    ) -> OCResult<StartResult> {
        self.user_games.entry(user_id).or_default().insert(
            game_id.to_string(),
            UserGame {
                number,
                started_at,
                entry_paid,
                hints: Vec::new(),
                hint_steps_used: 0,
                grid: Vec::new(),
                grid_saved_at: None,
                submits: 0,
                free_checks: 0,
                solved: None,
            },
        );

        // Free first plays are counted here rather than on the first solve, so a player who never
        // solves gets one free game and not an unlimited run of them
        let history = self.history.entry(user_id).or_default();
        if !history.ever_started {
            history.ever_started = true;
            history.first_started = Some(number);
            history.first_game = Some(game_id.to_string());
        }

        let puzzle = self.puzzles.get(game_id).ok_or_else(not_available)?;

        Ok(StartResult {
            started_at,
            state: self.user_state(user_id, puzzle),
            chit_balance: None,
            total_chit_earned: None,
        })
    }

    pub fn confirm_start(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber) {
        if let Some(record) = self
            .user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)
        {
            record.entry_paid = true;
        }
    }

    // Only ever removes a record whose fee never landed, so a retry that raced it is left alone
    pub fn release_start(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber) {
        let Some(games) = self.user_games.get_mut(&user_id) else {
            return;
        };
        if games.get(game_id).is_some_and(|r| r.number == number && !r.entry_paid) {
            games.remove(game_id);
        }
        if games.is_empty() {
            self.user_games.remove(&user_id);
        }
    }

    // Increments `submits` on every call. On a match the solve is recorded here, before any await.
    pub fn submit(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        grid: &[u8],
        now: TimestampMillis,
    ) -> OCResult<SubmitOutcome> {
        let puzzle = self.available(game_id, number, now)?;
        // The puzzle's own solution is the bound: a fixed cap unconnected to the generators is
        // either slack or, for the larger boards, smaller than a legitimate grid
        if grid.len() > puzzle.solution.len() {
            return Err(OCErrorCode::InvalidRequest.with_message("grid too large"));
        }

        let record = self.record(user_id, game_id, number).ok_or_else(not_started)?;
        // A start whose debit is still in flight is not a game yet. Without this a submit racing
        // the start call collects the full reward on a game whose entry fee then fails.
        if !record.entry_paid {
            return Err(entry_unpaid());
        }
        if record.solved.is_some() {
            return Err(OCErrorCode::AlreadyAwarded.into());
        }
        if record.submits >= puzzle.config.max_submits {
            return Err(OCErrorCode::Throttled.with_message("max_submits"));
        }

        let correct = grid == puzzle.solution.as_slice();
        let game_id = puzzle.game_id.clone();
        let min_carded_solve_ms = puzzle.config.min_carded_solve_ms;
        // Series-level: another game solved today does not change the run ending yesterday
        let prev_streak = self.prev_streak(user_id, number);
        let base_reward = reward_for_streak(&puzzle.config.reward_by_streak, prev_streak);
        // Paid hints only. `hint_steps_used` also counts a reservation whose debit is still in
        // flight or has since failed, and the reward and the published row are both written here,
        // before that is known: charging against it bills a hint the user never received.
        let hints_paid = hints_paid(record);
        let penalty = puzzle.config.hint_penalty.saturating_mul(hints_paid as u32);
        let reward = base_reward.saturating_sub(penalty);

        let record = self.user_games.get_mut(&user_id).and_then(|m| m.get_mut(&game_id)).unwrap();
        record.submits = record.submits.saturating_add(1);

        if !correct {
            return Err(OCErrorCode::InvalidRequest.with_message("wrong"));
        }

        let solve_time_ms = now.saturating_sub(record.started_at);
        let hints_used = hints_paid;
        let streak = prev_streak + 1;
        let solved = DailyPuzzleSolved {
            solved_at: now,
            solve_time_ms,
            reward,
            hints_used,
            streak,
            chit_balance: None,
            total_chit_earned: None,
        };
        record.solved = Some(solved.clone());

        let history = self.history.entry(user_id).or_default();
        // Series-level: the second game solved on a day leaves the run where the first put it
        if history.last_solved != Some(number) {
            history.last_solved = Some(number);
            history.streak = streak;
        }

        Ok(SubmitOutcome {
            solved,
            result: (solve_time_ms >= min_carded_solve_ms).then_some(DailyPuzzleResult {
                game_id,
                number,
                user_id,
                solve_time_ms,
                hints_used,
                streak,
                solved_at: now,
            }),
        })
    }

    #[expect(clippy::too_many_arguments)]
    // Picks the hint to serve and reserves its step before returning, so requests that overlap on
    // the debit's await cannot walk past `max_hints`: each one sees the step the last one took.
    // The hint itself is returned to this caller but is not written to state until `confirm_hint`
    // - `daily_puzzle_fetch` is a query, and anything in state during the debit is readable by a
    // caller who has not paid for it.
    pub fn reserve_hint(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        level: u8,
        filled: &[(u16, u8)],
        expected_price: u32,
        now: TimestampMillis,
    ) -> OCResult<HintPrepared> {
        if !(1..=3).contains(&level) {
            return Err(OCErrorCode::InvalidRequest.with_message("level"));
        }

        let puzzle = self.available(game_id, number, now)?;
        // The puzzle's own key space is the bound, as for the grid in `submit`
        if filled.len() > keys_in(puzzle) {
            return Err(OCErrorCode::InvalidRequest.with_message("filled too large"));
        }

        let record = self.record(user_id, game_id, number).ok_or_else(not_started)?;
        if !record.entry_paid {
            return Err(entry_unpaid());
        }
        if record.solved.is_some() {
            return Err(OCErrorCode::AlreadyAwarded.into());
        }
        let max_free_checks = puzzle.config.max_free_checks;

        // A reservation whose debit never came back would otherwise hold its step, and the place
        // that step took against `max_hints`, for the rest of the day
        self.expire_reservations(user_id, game_id, number, now);

        // Everything below reads the solution against client-chosen keys, and every outcome that
        // serves no paid hint is free. `filled` naming a single key turns that into a one-bit
        // oracle on that key, whichever way it comes back, so the check is taken here, before
        // anything branches on what the solution says, and given back in `reserve_step` on the one
        // path that serves a paid hint. Metering each outcome where it is raised instead left the
        // two raised before the first check - the hint cap, and a call with no step outstanding -
        // free, and a free refusal that only happens when the named keys are right is the whole
        // oracle: at the cap, every wrong guess costs a check and every right one costs nothing.
        //
        // A call with nothing in `filled` names no key, so no outcome of it can answer a question
        // about the solution and none of them is metered. That is also the call a client makes
        // when it has lost its own state and is re-reading what it has already bought.
        // See `DailyPuzzleConfig::max_free_checks`.
        let metered = !filled.is_empty();
        if metered {
            self.take_free_check(user_id, game_id, max_free_checks)?;
        }
        // Re-borrowed after the mutable calls above
        let puzzle = self.available(game_id, number, now)?;
        let record = self.record(user_id, game_id, number).ok_or_else(not_started)?;

        // A mistake always wins: free, not counted against the hint cap, not recorded.
        // Hint keys are game-specific (bridges and loopy key edges, not cells), so the generator's
        // (key, value) pairs are the lookup. A key it does not list is a mistake too: the client
        // claims a value for something the puzzle does not have. A puzzle pushed before the pairs
        // existed falls back to indexing the solution bytes, ignoring out-of-range keys.
        //
        // Only the lowest wrong key is returned, never the set. `filled` is client-supplied and
        // may name every key on the board, so returning every
        // disagreement would answer "which cells are not 1?" in one free call: the whole solution,
        // for nothing, bypassing the priced ladder entirely. One key per call keeps "check my
        // work" useful and makes walking the board a deliberate key-by-key exercise rather than a
        // single request.
        let wrong: Option<u16> = filled
            .iter()
            .filter(|(k, v)| {
                if puzzle.solution_pairs.is_empty() {
                    puzzle.solution.get(*k as usize).is_some_and(|s| s != v)
                } else {
                    // `solution_pairs` is sorted by key, so the lookup needs no map built per call
                    match puzzle.solution_pairs.binary_search_by_key(k, |(key, _)| *key) {
                        Ok(i) => puzzle.solution_pairs[i].1 != *v,
                        Err(_) => true,
                    }
                }
            })
            .map(|(k, _)| *k)
            .min();
        if let Some(wrong) = wrong {
            return Ok(HintPrepared::Mistake(HintResult {
                hint: ServedHint {
                    hint: PuzzleHint {
                        technique: 0,
                        focus: vec![wrong],
                        target: Vec::new(),
                        conclusions: Vec::new(),
                    },
                    level: 1,
                    mistake: true,
                },
                hints_used: hints_paid(record),
                state: self.user_state(user_id, puzzle),
                chit_balance: None,
                total_chit_earned: None,
            }));
        }

        let filled_set: BTreeSet<(u16, u8)> = filled.iter().copied().collect();
        // The generator's trace runs its cheapest rules to a standstill first, so the earliest
        // outstanding step is usually pure bookkeeping: crossing off squares the player has
        // already ruled out in their head but not marked (marks of "no line" / "no bulb" /
        // "grass" are optional, so `filled` rarely carries them). Serving that costs a hint and
        // teaches nothing, so prefer the first step that would actually put a mark on the board
        // - a conclusion with a non-zero value, which is a line, bulb, tent or bridge in every
        // game we have - and fall back to a negatives-only step only when nothing else is left.
        // A step counts as done once its positive conclusions are on the board; its negatives
        // may never be, and waiting for them would pin the player on a step they have finished.
        // The client applies the same test when it works out which level to ask for next.
        let positive_outstanding = |h: &PuzzleHint| h.conclusions.iter().any(|c| c.1 != 0 && !filled_set.contains(c));
        let outstanding = |h: &PuzzleHint| h.conclusions.iter().any(|c| !filled_set.contains(c));
        let (step, hint) = puzzle
            .hints
            .iter()
            .enumerate()
            .find(|(_, h)| positive_outstanding(h))
            .or_else(|| puzzle.hints.iter().enumerate().find(|(_, h)| outstanding(h)))
            .ok_or(OCErrorCode::ItemNotFound)?;
        let step = step as u16;

        let price_at = |level: u8| {
            puzzle
                .game_config
                .hint_prices
                .get(level as usize - 1)
                .copied()
                .ok_or_else(|| OCErrorCode::InvalidRequest.with_message("level"))
        };
        let mut price = price_at(level)?;

        match record.hints.iter().find(|e| e.step == step).and_then(|e| e.served.as_ref()) {
            Some(served) if level <= served.level => {
                return Ok(HintPrepared::AlreadyServed(HintResult {
                    hint: served.clone(),
                    hints_used: hints_paid(record),
                    state: self.user_state(user_id, puzzle),
                    chit_balance: None,
                    total_chit_earned: None,
                }));
            }
            // Upgrading a step already served: pay the difference, and count no new step. Charging
            // the new level in full would make climbing the ladder dearer than jumping to the top,
            // which punishes exactly the player the cheap tiers are there for. `hint_prices` is
            // validated as strictly increasing, so the difference is never zero.
            Some(served) => price = price.saturating_sub(price_at(served.level)?),
            None => {
                if record.hints.iter().all(|e| e.step != step) && record.hint_steps_used >= puzzle.game_config.max_hints {
                    return Err(OCErrorCode::Throttled.with_message("max_hints"));
                }
            }
        }

        if price != expected_price {
            // Quoted back rather than left to the client to work out again. The price depends on
            // which step the server picked and on what this user has already bought, so a client
            // holding a stale `hint_prices` or disagreeing about the step cannot always compute
            // it, and every guess is a metered call.
            return Err(OCErrorCode::PriceMismatch.with_message(price));
        }

        let served = ServedHint {
            hint: hint_at_level(hint, level),
            level,
            mistake: false,
        };
        let key = self.hint_key(game_id, number, step, level);
        let result = self.reserve_step(user_id, game_id, number, step, level, &served, metered, now)?;

        Ok(HintPrepared::Serve {
            step,
            level,
            result,
            price,
            key,
        })
    }

    // Spends one of the free outcomes this puzzle allows the user, or refuses once they are gone
    fn take_free_check(&mut self, user_id: UserId, game_id: &str, max: u16) -> OCResult<()> {
        let record = self
            .user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .ok_or_else(not_started)?;
        if record.free_checks >= max {
            return Err(OCErrorCode::Throttled.with_message("max_free_checks"));
        }
        record.free_checks = record.free_checks.saturating_add(1);
        Ok(())
    }

    // Claims the step against `max_hints` without putting the hint itself in state. The result is
    // for this caller alone, so it carries the reserved hint as though it were already paid for.
    // `refund_check` gives back the check `reserve_hint` took before it knew this call would end
    // up serving a paid hint; it is applied here, after the reservation, so an outcome that
    // refuses instead stays metered.
    #[expect(clippy::too_many_arguments)]
    fn reserve_step(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        step: u16,
        level: u8,
        served: &ServedHint,
        refund_check: bool,
        now: TimestampMillis,
    ) -> OCResult<HintResult> {
        let record = self
            .user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)
            .ok_or_else(not_started)?;

        if let Some(entry) = record.hints.iter_mut().find(|e| e.step == step) {
            // A step holds one reservation. A second call would overwrite the level the first is
            // paying for, so `confirm_hint` would find the wrong level and drop a paid hint, or
            // `release_hint` would delete the entry the other call is about to confirm.
            if entry.pending_level.is_some() {
                return Err(OCErrorCode::Throttled.with_message("hint in flight"));
            }
            entry.pending_level = Some(level);
            entry.pending_since = now;
        } else {
            record.hints.push(HintEntry {
                step,
                served: None,
                pending_level: Some(level),
                pending_since: now,
            });
            record.hint_steps_used = record.hint_steps_used.saturating_add(1);
        }
        if refund_check {
            record.free_checks = record.free_checks.saturating_sub(1);
        }
        let hints_used = record.hint_steps_used;

        let puzzle = self.puzzles.get(game_id).ok_or_else(not_available)?;

        Ok(HintResult {
            hint: served.clone(),
            hints_used,
            state: self.user_state_including(user_id, puzzle, Some((step, served))),
            chit_balance: None,
            total_chit_earned: None,
        })
    }

    // Writes the paid-for hint into state. `level` is the one this call reserved: a reservation
    // another call has since replaced is left alone.
    pub fn confirm_hint(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber, step: u16, level: u8) {
        let Some(hint) = self
            .puzzles
            .get(game_id)
            .filter(|p| p.number == number)
            .and_then(|p| p.hints.get(step as usize))
            .map(|h| hint_at_level(h, level))
        else {
            return;
        };
        let Some(entry) = self.entry_pending_at(user_id, game_id, number, step, level) else {
            return;
        };
        entry.pending_level = None;
        // An upgrade only ever raises the level, and a lower one landing late must not undo it
        if entry.served.as_ref().is_none_or(|s| s.level < level) {
            entry.served = Some(ServedHint {
                hint,
                level,
                mistake: false,
            });
        }
    }

    // Undoes `reserve_hint` when the debit did not go through. Only this call's own reservation
    // is dropped: a step another call has since paid for, or reserved at a different level, keeps
    // both its hint and its place in the count.
    pub fn release_hint(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber, step: u16, level: u8) {
        let Some(entry) = self.entry_pending_at(user_id, game_id, number, step, level) else {
            return;
        };
        entry.pending_level = None;
        if entry.served.is_some() {
            return;
        }
        let Some(record) = self.user_games.get_mut(&user_id).and_then(|m| m.get_mut(game_id)) else {
            return;
        };
        if let Some(i) = record.hints.iter().position(|e| e.step == step) {
            record.hints.remove(i);
            record.hint_steps_used = record.hint_steps_used.saturating_sub(1);
        }
    }

    // Drops reservations whose debit never came back. `confirm_hint` and `release_hint` both run
    // after the await, so a trap inside the callback - out of cycles, a memory limit - leaves the
    // reservation written before it with nothing to clear it, and the step answers "hint in
    // flight" for the rest of the day while still holding its place against `max_hints`. A step
    // nobody paid for goes back in the pool with its place; one that was paid for keeps both and
    // loses only the stale reservation.
    fn expire_reservations(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber, now: TimestampMillis) {
        let Some(record) = self
            .user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)
        else {
            return;
        };
        let mut dropped: u8 = 0;
        record.hints.retain_mut(|entry| {
            if entry.pending_level.is_none() || now.saturating_sub(entry.pending_since) < HINT_RESERVATION_TIMEOUT {
                return true;
            }
            entry.pending_level = None;
            if entry.served.is_some() {
                return true;
            }
            dropped = dropped.saturating_add(1);
            false
        });
        record.hint_steps_used = record.hint_steps_used.saturating_sub(dropped);
    }

    fn entry_pending_at(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        step: u16,
        level: u8,
    ) -> Option<&mut HintEntry> {
        self.user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)?
            .hints
            .iter_mut()
            .find(|e| e.step == step && e.pending_level == Some(level))
    }

    pub fn save_grid(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        grid: Vec<u8>,
        now: TimestampMillis,
    ) -> OCResult<()> {
        let puzzle = self.available(game_id, number, now)?;
        if grid.len() != puzzle.solution.len() {
            return Err(OCErrorCode::InvalidRequest.with_message("grid length"));
        }
        let record = self
            .user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)
            .ok_or_else(not_started)?;
        if !record.entry_paid {
            return Err(entry_unpaid());
        }
        if record.solved.is_some() {
            return Err(OCErrorCode::AlreadyAwarded.into());
        }
        record.grid = grid;
        record.grid_saved_at = Some(now);
        Ok(())
    }

    // What the push and pull log lines report. `metrics` also counts users, which walks a map
    // with an entry per user on the subnet, and those two run on every push and every pull.
    pub fn summary(&self) -> DailyPuzzleSummary {
        DailyPuzzleSummary {
            games: self.puzzles.keys().cloned().collect(),
            number: self.number,
            enabled: self.puzzles.values().any(|p| p.config.enabled),
        }
    }

    pub fn metrics(&self) -> DailyPuzzleEngineMetrics {
        let summary = self.summary();
        DailyPuzzleEngineMetrics {
            games: summary.games,
            number: summary.number,
            enabled: summary.enabled,
            users_with_records: self.user_games.values().filter(|m| !m.is_empty()).count() as u32,
            users_who_have_solved: self.history.values().filter(|h| h.last_solved.is_some()).count() as u64,
        }
    }

    // Zeroes a reward the user canister refused, so the record and anything fetched from it stop
    // claiming CHIT that was never credited
    pub fn clear_reward(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber) {
        if let Some(solved) = self
            .user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)
            .and_then(|r| r.solved.as_mut())
        {
            solved.reward = 0;
        }
    }

    // The enabled puzzles for today
    fn current(&self, now: TimestampMillis) -> impl Iterator<Item = &DailyPuzzle> {
        let today = day_number(now);
        self.puzzles.values().filter(move |p| p.config.enabled && p.number == today)
    }

    fn available(&self, game_id: &str, number: PuzzleNumber, now: TimestampMillis) -> OCResult<&DailyPuzzle> {
        let Some(puzzle) = self.puzzles.get(game_id).filter(|p| p.config.enabled) else {
            return Err(not_available());
        };
        if puzzle.number != day_number(now) || puzzle.number != number {
            return Err(OCErrorCode::Expired.into());
        }
        Ok(puzzle)
    }

    fn record(&self, user_id: UserId, game_id: &str, number: PuzzleNumber) -> Option<&UserGame> {
        self.user_games
            .get(&user_id)
            .and_then(|m| m.get(game_id))
            .filter(|r| r.number == number)
    }

    fn history(&self, user_id: UserId) -> Option<&UserHistory> {
        self.history.get(&user_id)
    }

    // The run of consecutive solved days ending at `number - 1`, which is what a solve on
    // `number` extends. A day already solved carries `number` itself in its streak, so the run
    // behind it is one shorter: without that, the second game solved on a day would be rewarded
    // as though the user were starting from nothing.
    fn prev_streak(&self, user_id: UserId, number: PuzzleNumber) -> u32 {
        match self.history(user_id) {
            Some(h) if h.last_solved == Some(number) => h.streak.saturating_sub(1),
            Some(h) if h.last_solved.is_some() && h.last_solved == number.checked_sub(1) => h.streak,
            _ => 0,
        }
    }

    // The streak as the user sees it: still live while today is unsolved, broken once a day has
    // passed without a solve
    fn current_streak(&self, user_id: UserId, number: PuzzleNumber) -> u32 {
        match self.history(user_id) {
            Some(h) if h.last_solved == Some(number) => h.streak,
            Some(h) if h.last_solved.is_some() && h.last_solved == number.checked_sub(1) => h.streak,
            _ => 0,
        }
    }

    fn entry_fee(&self, user_id: UserId, puzzle: &DailyPuzzle) -> u32 {
        if !puzzle.config.first_play_free {
            return puzzle.config.entry_fee;
        }
        match self.history(user_id) {
            // Never started, so this is the free one
            None => 0,
            Some(h) if !h.ever_started => 0,
            // The free play was spent on this game, today, and its record is gone - which is
            // what a `regenerate_today` leaves behind. A free entry pays no CHIT and so records no
            // `{game}:{number}:entry` key on the user canister, which is what makes a replayed
            // entry free; without this the replacement puzzle would charge the full fee to the one
            // player whose free play it was. `reserve_start` only asks while this game has no
            // record, so naming the game is what keeps the waiver to a restart: a second game on
            // the same day was never the free one, whatever happened to the first.
            Some(h) if h.first_started == Some(puzzle.number) && h.first_game.as_deref() == Some(puzzle.game_id.as_str()) => 0,
            _ => puzzle.config.entry_fee,
        }
    }

    fn user_state(&self, user_id: UserId, puzzle: &DailyPuzzle) -> DailyPuzzleUserState {
        self.user_state_including(user_id, puzzle, None)
    }

    // `pending` is a hint this call has just reserved but not yet paid for. It belongs in the
    // response that caller gets once the debit lands, and nowhere else: everything built without
    // it, `fetch` included, carries only hints already paid for.
    fn user_state_including(
        &self,
        user_id: UserId,
        puzzle: &DailyPuzzle,
        pending: Option<(u16, &ServedHint)>,
    ) -> DailyPuzzleUserState {
        let number = puzzle.number;
        let record = self.record(user_id, &puzzle.game_id, number);
        let history = self.history(user_id);

        DailyPuzzleUserState {
            game_id: puzzle.game_id.clone(),
            number,
            started_at: record.map(|r| r.started_at),
            hints: record
                .map(|r| {
                    r.hints
                        .iter()
                        .filter_map(|e| match pending {
                            Some((step, served)) if e.step == step => Some(served.clone()),
                            _ => e.served.clone(),
                        })
                        .collect()
                })
                .unwrap_or_default(),
            grid: record.map(|r| r.grid.clone()).unwrap_or_default(),
            grid_saved_at: record.and_then(|r| r.grid_saved_at),
            solved: record.and_then(|r| r.solved.clone()),
            submits: record.map(|r| r.submits).unwrap_or_default(),
            free_checks: record.map(|r| r.free_checks).unwrap_or_default(),
            streak: self.current_streak(user_id, number),
            has_solved_before: history.is_some_and(|h| h.last_solved.is_some()),
            // Settled once the record exists, so the client only ever sends this while there is
            // nothing to pay or nothing started
            entry_fee: if record.is_some() { 0 } else { self.entry_fee(user_id, puzzle) },
        }
    }
}

// How many distinct keys the puzzle has: one per byte of the solution, except for the games that
// key something other than cells (bridges and loopy key edges), which list their pairs
fn keys_in(puzzle: &DailyPuzzle) -> usize {
    if puzzle.solution_pairs.is_empty() { puzzle.solution.len() } else { puzzle.solution_pairs.len() }
}

// Hint steps the user has actually paid for, as opposed to `hint_steps_used`, which also holds
// reservations that are still in flight. Only the paid ones may cost the user reward.
fn hints_paid(record: &UserGame) -> u8 {
    record.hints.iter().filter(|e| e.served.is_some()).count() as u8
}

fn reward_for_streak(table: &[u32], prev_streak: u32) -> u32 {
    if table.is_empty() {
        return 0;
    }
    let index = (prev_streak as usize).min(table.len() - 1);
    table[index]
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::{DailyPuzzleConfig, GameConfig};

    const GAME: &str = "light_up";
    const OTHER: &str = "other";
    const NUMBER: PuzzleNumber = 20_000;
    const START: TimestampMillis = NUMBER as u64 * DAY_IN_MS + 1_000;

    fn user(n: u8) -> UserId {
        Principal::from_slice(&[n, 0, 0, 0, 0, 0, 0, 0, 1]).into()
    }

    // 3x3 with a black cell in the middle. Solution: bulbs at 0, 6 and 8.
    fn puzzle(number: PuzzleNumber, enabled: bool) -> DailyPuzzle {
        puzzle_for(GAME, number, enabled)
    }

    fn puzzle_for(game_id: &str, number: PuzzleNumber, enabled: bool) -> DailyPuzzle {
        DailyPuzzle {
            game_id: game_id.to_string(),
            number,
            tier: 0,
            description: vec![1, 3, 3, 0, 0, 0, 0, 0x10, 0, 0, 0, 0],
            solution: vec![1, 0, 0, 0, 0, 0, 1, 0, 1],
            solution_pairs: Vec::new(),
            hints: vec![
                PuzzleHint {
                    technique: 1,
                    focus: vec![4],
                    target: Vec::new(),
                    conclusions: vec![(0, 1), (2, 0)],
                },
                PuzzleHint {
                    technique: 2,
                    focus: vec![1],
                    target: Vec::new(),
                    conclusions: vec![(6, 1)],
                },
                PuzzleHint {
                    technique: 3,
                    focus: vec![7],
                    target: Vec::new(),
                    conclusions: vec![(8, 1)],
                },
                PuzzleHint {
                    technique: 4,
                    focus: vec![5],
                    target: Vec::new(),
                    conclusions: vec![(5, 0)],
                },
            ],
            starts_at: number as u64 * DAY_IN_MS,
            expires_at: (number as u64 + 1) * DAY_IN_MS,
            config: DailyPuzzleConfig {
                enabled,
                entry_fee: 100,
                first_play_free: true,
                reward_by_streak: vec![250, 300, 350],
                hint_penalty: 50,
                min_carded_solve_ms: 10_000,
                max_submits: 3,
                max_free_checks: 20,
            },
            game_config: GameConfig {
                hint_prices: vec![25, 75, 200],
                max_hints: 2,
            },
        }
    }

    fn new_engine() -> DailyPuzzleEngine {
        let mut engine = DailyPuzzleEngine::default();
        engine.set_puzzles(vec![puzzle(NUMBER, true)]);
        engine
    }

    fn started(engine: &mut DailyPuzzleEngine, user_id: UserId, now: TimestampMillis) {
        started_game(engine, user_id, GAME, now);
    }

    fn started_game(engine: &mut DailyPuzzleEngine, user_id: UserId, game_id: &str, now: TimestampMillis) {
        let expected_fee = engine.entry_fee(user_id, engine.puzzle(game_id).unwrap());
        match engine.reserve_start(user_id, game_id, NUMBER, expected_fee, now) {
            Ok(StartPrepared::Start { .. }) => {}
            Ok(StartPrepared::AlreadyStarted(_)) => panic!("already started"),
            Err(e) => panic!("{e:?}"),
        };
        engine.confirm_start(user_id, game_id, NUMBER);
    }

    // Writes the history a run of solved days would have left behind
    fn seed_solved(engine: &mut DailyPuzzleEngine, user_id: UserId, numbers: &[PuzzleNumber]) {
        let history = engine.history.entry(user_id).or_default();
        history.ever_started = true;
        for number in numbers.iter().copied() {
            let streak = if history.last_solved == number.checked_sub(1) { history.streak + 1 } else { 1 };
            if history.last_solved != Some(number) {
                history.last_solved = Some(number);
                history.streak = streak;
            }
        }
    }

    fn state_for(engine: &DailyPuzzleEngine, user_id: UserId, game_id: &str, now: TimestampMillis) -> DailyPuzzleUserState {
        engine
            .fetch(user_id, now)
            .states
            .into_iter()
            .find(|s| s.game_id == game_id)
            .unwrap_or_else(|| panic!("no state for {game_id}"))
    }

    fn state(engine: &DailyPuzzleEngine, user_id: UserId, now: TimestampMillis) -> DailyPuzzleUserState {
        state_for(engine, user_id, GAME, now)
    }

    fn assert_err(result: OCResult<impl Sized>, code: OCErrorCode) {
        match result {
            Err(e) => assert!(e.matches_code(code), "unexpected error {} {:?}", e.code(), e.message()),
            Ok(_) => panic!("expected an error"),
        }
    }

    // The free first play depends on history no client can see, so the fee has to come back in
    // the state the client starts from. A player who started once and never solved is the case
    // `has_solved_before` cannot express.
    #[test]
    fn state_carries_the_fee_that_start_will_expect() {
        let mut engine = new_engine();
        let u = user(1);

        // Never played: free, and start accepts what the state said
        assert_eq!(state(&engine, u, START).entry_fee, 0);
        started(&mut engine, u, START);

        // Started, never solved, next day: the free play is spent, and nothing in
        // `has_solved_before` says so
        let next = NUMBER + 1;
        engine.set_puzzles(vec![puzzle(next, true)]);
        let now = next as u64 * DAY_IN_MS + 1_000;
        let s = state(&engine, u, now);
        assert!(!s.has_solved_before);
        assert_eq!(s.entry_fee, 100);
        assert_err(engine.reserve_start(u, GAME, next, 0, now), OCErrorCode::PriceMismatch);
        assert!(matches!(
            engine.reserve_start(u, GAME, next, s.entry_fee, now),
            Ok(StartPrepared::Start { .. })
        ));

        // Nothing left to pay once the record exists
        assert_eq!(state(&engine, u, now).entry_fee, 0);
    }

    // A free entry pays no CHIT and so leaves no idempotency key behind. Without the day being
    // remembered, the replacement puzzle charges the one player whose free play it was.
    #[test]
    fn a_regenerated_puzzle_is_a_free_restart_for_a_first_play() {
        let mut engine = new_engine();
        let u = user(1);
        assert_eq!(state(&engine, u, START).entry_fee, 0);
        started(&mut engine, u, START);

        // regenerate_today: same number, different puzzle, so the record is dropped
        let mut replacement = puzzle(NUMBER, true);
        replacement.description = vec![1, 3, 3, 0, 0, 0, 0, 0x20, 0, 0, 0, 0];
        assert!(engine.set_puzzles(vec![replacement]));
        assert!(engine.record(u, GAME, NUMBER).is_none());

        assert_eq!(state(&engine, u, START).entry_fee, 0);

        // But a second game on the same day still pays: the free play is spent, not the day
        engine.set_puzzles(vec![puzzle(NUMBER, true), puzzle_for(OTHER, NUMBER, true)]);
        started_game(&mut engine, u, GAME, START);
        assert_eq!(state_for(&engine, u, OTHER, START).entry_fee, 100);
    }

    // Subnet clocks differ, and a retry or a restored snapshot can carry an older number. Taken as
    // a day change it clears every in-progress record on the subnet, entry fees included.
    #[test]
    fn a_push_for_an_older_number_is_ignored() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        assert!(!engine.set_puzzles(vec![puzzle(NUMBER - 1, true)]));
        assert_eq!(engine.number, Some(NUMBER));
        assert!(engine.record(u, GAME, NUMBER).is_some());
    }

    // The reward and the results row are both written before the hint debit is known to have
    // landed, so they can only charge for hints already paid for
    #[test]
    fn a_hint_whose_debit_never_landed_costs_no_reward() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();

        let step = match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
            HintPrepared::Serve { step, .. } => step,
            _ => panic!("expected a serve"),
        };
        // The debit is still in flight when the solve comes in
        let outcome = engine.submit(u, GAME, NUMBER, &solution, START + 20_000).unwrap();
        assert_eq!(outcome.solved.hints_used, 0);
        assert_eq!(outcome.solved.reward, 250);
        assert_eq!(outcome.result.unwrap().hints_used, 0);

        // And the debit then fails
        engine.release_hint(u, GAME, NUMBER, step, 1);
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 0);
    }

    // Every outcome that serves no paid hint answers "is this key right?" for a client-chosen key,
    // so all of them are bounded: refusing one and not the other still tells the caller which.
    #[test]
    fn free_hint_outcomes_are_bounded() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let max = engine.puzzle(GAME).unwrap().config.max_free_checks;

        // A mistake: key 1 is 0 in the solution
        for _ in 0..max {
            assert!(matches!(
                engine.reserve_hint(u, GAME, NUMBER, 1, &[(1, 1)], 25, START),
                Ok(HintPrepared::Mistake(_))
            ));
        }
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[(1, 1)], 25, START),
            OCErrorCode::Throttled,
        );
        // The other half of the oracle, a correct key, is spent too
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[(0, 1)], 9, START),
            OCErrorCode::Throttled,
        );

        // And a paid hint still goes through
        assert!(matches!(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START),
            Ok(HintPrepared::Serve { .. })
        ));
    }

    // At the hint cap every outcome is a refusal, so the refusals have to cost the same. One that
    // only happens when the keys in `filled` are right, and costs nothing, is the oracle back:
    // every wrong guess pays, every right one is free, and the two are told apart by the message.
    #[test]
    fn refusals_at_the_hint_cap_are_metered_too() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        // max_hints is 2, and a paid hint gives its check back
        serve(&mut engine, u, 1, &[], 25);
        serve(&mut engine, u, 1, &[(0, 1), (2, 0)], 25);
        assert_eq!(state(&engine, u, START).free_checks, 0);

        // A probe whose keys are all right is refused by the cap, and pays for that answer
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[(0, 1), (2, 0), (6, 1)], 25, START),
            OCErrorCode::Throttled,
        );
        assert_eq!(state(&engine, u, START).free_checks, 1);

        // And once the budget is gone, a right guess and a wrong one refuse identically
        let max = engine.puzzle(GAME).unwrap().config.max_free_checks;
        while state(&engine, u, START).free_checks < max {
            let _ = engine.reserve_hint(u, GAME, NUMBER, 1, &[(1, 1)], 25, START);
        }
        for filled in [&[(1u16, 1u8)][..], &[(0, 1), (2, 0), (6, 1)][..]] {
            match engine.reserve_hint(u, GAME, NUMBER, 1, filled, 25, START) {
                Err(error) => assert_eq!(error.message(), Some("max_free_checks")),
                Ok(_) => panic!("expected an error"),
            }
        }
    }

    // A call naming no key asks nothing about the solution, so nothing it can answer is worth a
    // check. That is the call a client makes when it has lost its own state and is re-reading
    // what it has already bought.
    #[test]
    fn a_hint_call_with_nothing_filled_is_not_metered() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let (step, _) = serve(&mut engine, u, 2, &[], 75);
        for _ in 0..engine.puzzle(GAME).unwrap().config.max_free_checks + 1 {
            match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
                HintPrepared::AlreadyServed(r) => assert_eq!(r.hint.level, 2),
                _ => panic!("expected a re-serve"),
            }
        }
        assert_eq!(state(&engine, u, START).free_checks, 0);
        assert_eq!(state(&engine, u, START).hints.len(), 1);
        assert_eq!(step, 0);
    }

    // `confirm_hint` and `release_hint` both run after the debit's await, so a trap inside the
    // callback leaves a reservation with nothing to clear it. Left alone it holds its step, and
    // the place that step took against `max_hints`, for the rest of the day.
    #[test]
    fn a_reservation_whose_debit_never_came_back_expires() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let step = match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
            HintPrepared::Serve { step, .. } => step,
            _ => panic!("expected a serve"),
        };
        // Neither confirm nor release runs
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START),
            OCErrorCode::Throttled,
        );
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 1);

        // Once it has expired the step is back, and it still counts once against the cap
        let later = START + HINT_RESERVATION_TIMEOUT;
        match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, later).unwrap() {
            HintPrepared::Serve { step: retried, .. } => assert_eq!(retried, step),
            _ => panic!("expected a serve"),
        }
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 1);
    }

    // The free play is spent on one game, not on the day. A `regenerate_today` that leaves the
    // user holding no record at all must not hand every other game that day away as well.
    #[test]
    fn the_restart_waiver_does_not_leak_to_another_game() {
        let mut engine = new_engine();
        let u = user(1);
        engine.set_puzzles(vec![puzzle(NUMBER, true), puzzle_for(OTHER, NUMBER, true)]);
        assert_eq!(state(&engine, u, START).entry_fee, 0);
        started(&mut engine, u, START);

        // The game the free play was spent on is regenerated, so the user holds no record at all
        let mut replacement = puzzle(NUMBER, true);
        replacement.description = vec![1, 3, 3, 0, 0, 0, 0, 0x20, 0, 0, 0, 0];
        assert!(engine.set_puzzles(vec![replacement, puzzle_for(OTHER, NUMBER, true)]));
        assert!(engine.record(u, GAME, NUMBER).is_none());

        // The replacement is the free restart; the game the free play was never spent on is not
        assert_eq!(state(&engine, u, START).entry_fee, 0);
        assert_eq!(state_for(&engine, u, OTHER, START).entry_fee, 100);
    }

    #[test]
    fn old_single_slot_blob_deserialises_to_an_empty_engine() {
        // The shape before the per-game map: `puzzle: Option<DailyPuzzle>` with hint fields on the
        // config, `users: {uid: UserGame}` and `solved: {uid: {game: [numbers]}}`
        let uid = user(1).to_string();
        let old = serde_json::json!({
            "puzzle": {
                "game_id": GAME,
                "number": 20705,
                "tier": 0,
                "description": [1, 3, 3, 0, 0, 0, 0, 16, 0, 0, 0, 0],
                "solution": [1, 0, 0, 0, 0, 0, 1, 0, 1],
                "hints": [],
                "starts_at": 20705u64 * DAY_IN_MS,
                "expires_at": 20706u64 * DAY_IN_MS,
                "config": {
                    "enabled": true,
                    "entry_fee": 100,
                    "first_play_free": true,
                    "hint_prices": [0, 100, 200],
                    "max_hints": 3,
                    "reward_by_streak": [250, 300],
                    "hint_penalty": 50,
                    "min_carded_solve_ms": 10000,
                    "max_submits": 20
                }
            },
            "users": {
                uid.clone(): {
                    "number": 20705,
                    "started_at": 20705u64 * DAY_IN_MS + 1000,
                    "entry_paid": true,
                    "hints": [],
                    "hint_steps_used": 0,
                    "grid": [],
                    "grid_saved_at": null,
                    "submits": 1,
                    "solved": null
                }
            },
            "solved": { uid: { GAME: [20704] } }
        });
        let bytes = msgpack::serialize_then_unwrap(&old);

        let engine: DailyPuzzleEngine = msgpack::deserialize_then_unwrap(&bytes);
        let metrics = engine.metrics();
        assert_eq!(metrics.number, None);
        assert!(metrics.games.is_empty());
        assert_eq!(metrics.users_with_records, 0);
        assert_eq!(metrics.users_who_have_solved, 0);
        assert!(engine.is_stale(START));
        assert!(engine.fetch(user(1), START).puzzles.is_empty());

        // The current shape round-trips
        let mut engine = new_engine();
        started(&mut engine, user(1), START);
        let bytes = msgpack::serialize_then_unwrap(&engine);
        let engine: DailyPuzzleEngine = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(engine.metrics().users_with_records, 1);
        assert_eq!(engine.metrics().number, Some(NUMBER));
    }

    #[test]
    fn start_is_idempotent_and_keeps_the_original_clock() {
        let mut engine = new_engine();
        let u = user(1);
        let first = match engine.reserve_start(u, GAME, NUMBER, 0, START).unwrap() {
            StartPrepared::Start { fee: 0, result, .. } => result,
            _ => panic!("expected a free start"),
        };
        assert_eq!(first.started_at, START);
        assert_eq!(first.state.started_at, Some(START));
        assert_eq!(first.state.game_id, GAME);

        match engine.reserve_start(u, GAME, NUMBER, 999, START + 5_000).unwrap() {
            StartPrepared::AlreadyStarted(r) => assert_eq!(r.started_at, START),
            StartPrepared::Start { .. } => panic!("second start should not debit"),
        }
    }

    #[test]
    fn entry_fee_waived_only_until_the_first_start() {
        let mut engine = new_engine();
        let u = user(1);
        assert!(matches!(
            engine.reserve_start(u, GAME, NUMBER, 0, START),
            Ok(StartPrepared::Start { fee: 0, .. })
        ));

        // Gated on starting, not solving: tomorrow costs, however today's game went
        engine.set_puzzles(vec![puzzle(NUMBER + 1, true)]);
        assert!(matches!(
            engine.reserve_start(u, GAME, NUMBER + 1, 100, START + DAY_IN_MS),
            Ok(StartPrepared::Start { fee: 100, .. })
        ));

        let mut engine = new_engine();
        seed_solved(&mut engine, user(2), &[NUMBER - 10]);
        assert!(matches!(
            engine.reserve_start(user(2), GAME, NUMBER, 100, START),
            Ok(StartPrepared::Start { fee: 100, .. })
        ));

        let mut engine = DailyPuzzleEngine::default();
        let mut p = puzzle(NUMBER, true);
        p.config.first_play_free = false;
        engine.set_puzzles(vec![p]);
        assert!(matches!(
            engine.reserve_start(u, GAME, NUMBER, 100, START),
            Ok(StartPrepared::Start { fee: 100, .. })
        ));
    }

    // Everything the record allows hangs off the entry fee having landed. Without this a submit
    // racing the start call collects the reward on a game whose fee is then refused.
    #[test]
    fn nothing_works_while_the_entry_fee_is_in_flight() {
        let mut engine = new_engine();
        let u = user(1);
        seed_solved(&mut engine, u, &[NUMBER - 10]);
        engine.reserve_start(u, GAME, NUMBER, 100, START).unwrap();

        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        assert_err(engine.submit(u, GAME, NUMBER, &solution, START), OCErrorCode::InvalidRequest);
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START),
            OCErrorCode::InvalidRequest,
        );
        assert_err(
            engine.save_grid(u, GAME, NUMBER, solution.clone(), START),
            OCErrorCode::InvalidRequest,
        );
        assert!(engine.record(u, GAME, NUMBER).unwrap().solved.is_none());

        engine.confirm_start(u, GAME, NUMBER);
        engine.submit(u, GAME, NUMBER, &solution, START).unwrap();
    }

    // The caps come from the puzzle itself. A fixed one is either slack or, for a board with more
    // keys than bytes in a small grid, smaller than a legitimate submission.
    #[test]
    fn grid_and_filled_bounds_come_from_the_puzzle() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let len = engine.puzzle(GAME).unwrap().solution.len();

        assert_err(
            engine.submit(u, GAME, NUMBER, &vec![0; len + 1], START),
            OCErrorCode::InvalidRequest,
        );
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &vec![(0u16, 1u8); len + 1], 25, START),
            OCErrorCode::InvalidRequest,
        );
        // A grid exactly the size of the solution is a legitimate submission, right or wrong
        assert_err(
            engine.submit(u, GAME, NUMBER, &vec![0; len], START),
            OCErrorCode::InvalidRequest,
        );
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().submits, 1);
    }

    #[test]
    fn start_price_mismatch() {
        let mut engine = new_engine();
        assert_err(
            engine.reserve_start(user(1), GAME, NUMBER, 100, START),
            OCErrorCode::PriceMismatch,
        );
    }

    #[test]
    fn not_available_when_disabled_wrong_number_expired_or_unknown_game() {
        let mut engine = DailyPuzzleEngine::default();
        assert_err(
            engine.reserve_start(user(1), GAME, NUMBER, 0, START),
            OCErrorCode::NotInitialized,
        );
        assert!(engine.fetch(user(1), START).puzzles.is_empty());
        assert!(engine.fetch(user(1), START).states.is_empty());

        engine.set_puzzles(vec![puzzle(NUMBER, false)]);
        assert_err(
            engine.reserve_start(user(1), GAME, NUMBER, 0, START),
            OCErrorCode::NotInitialized,
        );
        assert!(engine.fetch(user(1), START).puzzles.is_empty());

        engine.set_puzzles(vec![puzzle(NUMBER, true)]);
        assert_err(
            engine.reserve_start(user(1), GAME, NUMBER + 1, 0, START),
            OCErrorCode::Expired,
        );
        assert_err(
            engine.reserve_start(user(1), GAME, NUMBER, 0, START + DAY_IN_MS),
            OCErrorCode::Expired,
        );
        assert!(engine.fetch(user(1), START + DAY_IN_MS).puzzles.is_empty());
        // Unknown game for today
        assert_err(
            engine.reserve_start(user(1), OTHER, NUMBER, 0, START),
            OCErrorCode::NotInitialized,
        );
        assert_err(
            engine.save_grid(user(1), OTHER, NUMBER, vec![0; 9], START),
            OCErrorCode::NotInitialized,
        );

        let fetched = engine.fetch(user(1), START);
        assert_eq!(fetched.puzzles.len(), 1);
        assert_eq!(fetched.puzzles[0].number, NUMBER);
        assert_eq!(fetched.states.len(), 1);
        assert_eq!(fetched.states[0].started_at, None);
        assert_eq!(fetched.states[0].game_id, GAME);
    }

    #[test]
    fn wrong_submit_errors_and_counts() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let Err(err) = engine.submit(u, GAME, NUMBER, &[0; 9], START + 100) else {
            panic!("wrong grid should fail")
        };
        assert!(err.matches_code(OCErrorCode::InvalidRequest));
        assert_eq!(err.message(), Some("wrong"));
        assert_eq!(state(&engine, u, START).submits, 1);
    }

    #[test]
    fn submits_are_capped() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        for _ in 0..3 {
            assert_err(engine.submit(u, GAME, NUMBER, &[0; 9], START), OCErrorCode::InvalidRequest);
        }
        assert_err(engine.submit(u, GAME, NUMBER, &[0; 9], START), OCErrorCode::Throttled);
        // Even a correct grid is refused once the cap is hit
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        assert_err(engine.submit(u, GAME, NUMBER, &solution, START), OCErrorCode::Throttled);
    }

    #[test]
    fn submit_before_start_errors() {
        let mut engine = new_engine();
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        assert_err(
            engine.submit(user(1), GAME, NUMBER, &solution, START),
            OCErrorCode::InvalidRequest,
        );
    }

    #[test]
    fn correct_submit_solves_with_reward_from_prior_streak() {
        let mut engine = new_engine();
        let u = user(1);
        seed_solved(&mut engine, u, &[NUMBER - 2, NUMBER - 1]);
        started(&mut engine, u, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();

        let outcome = engine.submit(u, GAME, NUMBER, &solution, START + 42_000).unwrap();
        assert_eq!(outcome.solved.solve_time_ms, 42_000);
        assert_eq!(outcome.solved.reward, 350);
        assert_eq!(outcome.solved.streak, 3);
        assert_eq!(outcome.solved.hints_used, 0);
        assert_eq!(outcome.solved.solved_at, START + 42_000);
        assert_eq!(outcome.result.as_ref().unwrap().user_id, u);
        assert_eq!(outcome.result.as_ref().unwrap().game_id, GAME);
        assert_eq!(outcome.result.as_ref().unwrap().number, NUMBER);
        assert_eq!(outcome.result.as_ref().unwrap().streak, 3);
        assert_eq!(outcome.result.as_ref().unwrap().solve_time_ms, 42_000);

        let state = state(&engine, u, START);
        assert_eq!(state.streak, 3);
        assert!(state.has_solved_before);
        assert_eq!(state.solved.unwrap().reward, 350);
        assert_eq!(state.submits, 1);

        // Second submit is refused
        assert_err(engine.submit(u, GAME, NUMBER, &solution, START), OCErrorCode::AlreadyAwarded);

        // Reward index clamps to the last entry of the table
        let mut engine = new_engine();
        seed_solved(&mut engine, u, &[NUMBER - 5, NUMBER - 4, NUMBER - 3, NUMBER - 2, NUMBER - 1]);
        started(&mut engine, u, START);
        let outcome = engine.submit(u, GAME, NUMBER, &solution, START).unwrap();
        assert_eq!(outcome.solved.reward, 350);
        assert_eq!(outcome.solved.streak, 6);

        // A gap before today resets to the base reward
        let mut engine = new_engine();
        seed_solved(&mut engine, u, &[NUMBER - 3, NUMBER - 2]);
        started(&mut engine, u, START);
        let outcome = engine.submit(u, GAME, NUMBER, &solution, START).unwrap();
        assert_eq!(outcome.solved.reward, 250);
        assert_eq!(outcome.solved.streak, 1);
    }

    #[test]
    fn two_games_same_day_have_separate_records_and_one_streak_day() {
        let mut engine = DailyPuzzleEngine::default();
        engine.set_puzzles(vec![puzzle(NUMBER, true), puzzle_for(OTHER, NUMBER, true)]);
        let u = user(1);
        seed_solved(&mut engine, u, &[NUMBER - 1]);

        let fetched = engine.fetch(u, START);
        assert_eq!(fetched.puzzles.len(), 2);
        assert_eq!(fetched.states.len(), 2);
        assert!(fetched.states.iter().all(|s| s.streak == 1 && s.has_solved_before));

        // Starting one game leaves the other unstarted
        started_game(&mut engine, u, GAME, START);
        assert_eq!(state_for(&engine, u, GAME, START).started_at, Some(START));
        assert_eq!(state_for(&engine, u, OTHER, START).started_at, None);
        assert_err(engine.submit(u, OTHER, NUMBER, &[0; 9], START), OCErrorCode::InvalidRequest);

        // A wrong submit on one game does not count against the other
        assert_err(engine.submit(u, GAME, NUMBER, &[0; 9], START), OCErrorCode::InvalidRequest);
        started_game(&mut engine, u, OTHER, START + 100);
        assert_eq!(state_for(&engine, u, GAME, START).submits, 1);
        assert_eq!(state_for(&engine, u, OTHER, START).submits, 0);

        // Solving both pays two rewards, each from the run ending yesterday
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        let first = engine.submit(u, GAME, NUMBER, &solution, START + 10_000).unwrap();
        assert_eq!(first.solved.reward, 300);
        assert_eq!(first.solved.streak, 2);
        assert_eq!(first.result.as_ref().unwrap().game_id, GAME);
        // Yesterday (seeded) plus today
        assert_eq!(engine.metrics().users_who_have_solved, 1);

        let second = engine.submit(u, OTHER, NUMBER, &solution, START + 20_000).unwrap();
        assert_eq!(second.solved.reward, 300);
        assert_eq!(second.solved.streak, 2);
        assert_eq!(second.solved.solve_time_ms, 19_900);
        assert_eq!(second.result.as_ref().unwrap().game_id, OTHER);
        // The day counts once
        assert_eq!(engine.metrics().users_who_have_solved, 1);
        assert_eq!(engine.metrics().users_with_records, 1);

        let fetched = engine.fetch(u, START);
        assert!(fetched.states.iter().all(|s| s.streak == 2 && s.has_solved_before));
        assert!(fetched.states.iter().all(|s| s.solved.is_some()));
        assert_eq!(
            fetched.states.iter().map(|s| s.solved.as_ref().unwrap().reward).sum::<u32>(),
            600
        );

        // has_solved_before flips after the first solve of a fresh user
        let v = user(2);
        assert!(!state_for(&engine, v, GAME, START).has_solved_before);
        assert_eq!(engine.entry_fee(v, engine.puzzle(OTHER).unwrap()), 0);
        started_game(&mut engine, v, GAME, START);
        engine.submit(v, GAME, NUMBER, &solution, START).unwrap();
        assert!(state_for(&engine, v, GAME, START).has_solved_before);
        assert!(state_for(&engine, v, OTHER, START).has_solved_before);
        assert_eq!(engine.entry_fee(v, engine.puzzle(OTHER).unwrap()), 100);
    }

    #[test]
    fn hint_penalty_applies_to_every_step_served() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();

        // Two steps, bought at different levels: the penalty does not care which
        serve(&mut engine, u, 1, &[], 25);
        serve(&mut engine, u, 2, &[(0, 1), (2, 0)], 75);

        let outcome = engine.submit(u, GAME, NUMBER, &solution, START + 10_000).unwrap();
        assert_eq!(outcome.solved.reward, 150);
        assert_eq!(outcome.solved.hints_used, 2);
        assert_eq!(outcome.result.as_ref().unwrap().hints_used, 2);
    }

    #[test]
    fn streak_derivation() {
        // The run behind a solve, which is what the reward is priced off
        let mut engine = new_engine();
        let u = user(1);
        seed_solved(&mut engine, u, &[10, 11, 12]);
        assert_eq!(engine.prev_streak(u, 13), 3);
        assert_eq!(engine.prev_streak(u, 14), 0);
        // The second game solved on a day sees the same run behind it as the first
        assert_eq!(engine.prev_streak(u, 12), 2);
        assert_eq!(engine.prev_streak(user(9), 13), 0);

        // Card streak: yesterday's run until today is solved
        let mut engine = new_engine();
        let u = user(1);
        seed_solved(&mut engine, u, &[NUMBER - 2, NUMBER - 1]);
        assert_eq!(state(&engine, u, START).streak, 2);
        seed_solved(&mut engine, u, &[NUMBER]);
        assert_eq!(state(&engine, u, START).streak, 3);
        let mut engine = new_engine();
        seed_solved(&mut engine, u, &[NUMBER - 3]);
        assert_eq!(state(&engine, u, START).streak, 0);
        assert!(state(&engine, u, START).has_solved_before);
    }

    fn serve(
        engine: &mut DailyPuzzleEngine,
        u: UserId,
        level: u8,
        filled: &[(u16, u8)],
        expected_price: u32,
    ) -> (u16, HintResult) {
        let (step, result) = match engine.reserve_hint(u, GAME, NUMBER, level, filled, expected_price, START) {
            Ok(HintPrepared::Serve { step, result, .. }) => (step, result),
            Ok(HintPrepared::Mistake(_)) => panic!("unexpected mistake"),
            Ok(HintPrepared::AlreadyServed(_)) => panic!("unexpected re-serve"),
            Err(e) => panic!("{e:?}"),
        };
        engine.confirm_hint(u, GAME, NUMBER, step, level);
        (step, result)
    }

    // Step selection only: reserve then put the step straight back, so repeated probes neither
    // consume the hint budget nor turn into re-serves
    fn probe(engine: &mut DailyPuzzleEngine, u: UserId, filled: &[(u16, u8)]) -> u16 {
        let step = match engine.reserve_hint(u, GAME, NUMBER, 1, filled, 25, START) {
            Ok(HintPrepared::Serve { step, .. }) => step,
            Ok(_) => panic!("expected a serve"),
            Err(e) => panic!("{e:?}"),
        };
        engine.release_hint(u, GAME, NUMBER, step, 1);
        step
    }

    #[test]
    fn hint_mistake_wins_and_is_free() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        // Cell 1 is wrong, cell 0 is right, key 99 is out of range and ignored
        match engine
            .reserve_hint(u, GAME, NUMBER, 3, &[(1, 1), (0, 1), (99, 1)], 0, START)
            .unwrap()
        {
            HintPrepared::Mistake(r) => {
                assert!(r.hint.mistake);
                assert_eq!(r.hint.level, 1);
                assert_eq!(r.hint.hint.focus, vec![1]);
                assert!(r.hint.hint.conclusions.is_empty());
                assert_eq!(r.hints_used, 0);
            }
            _ => panic!("expected a mistake hint"),
        }
        assert!(state(&engine, u, START).hints.is_empty());
    }

    // Keys that are not byte indexes (edge keys, as bridges and loopy use). The solution bytes are
    // arranged so that indexing them by key would give the opposite answer in every case.
    #[test]
    fn hint_mistake_uses_solution_pairs_not_byte_indexes() {
        let mut engine = DailyPuzzleEngine::default();
        let mut p = puzzle(NUMBER, true);
        // Byte 1 is 0 but key 1 is 1; byte 0 is 1 but key 0 is absent; 100+ are out of byte range
        p.solution_pairs = vec![(1, 1), (100, 2), (102, 0), (104, 1)];
        p.hints = vec![
            PuzzleHint {
                technique: 1,
                focus: vec![100],
                target: Vec::new(),
                conclusions: vec![(100, 2), (102, 0)],
            },
            PuzzleHint {
                technique: 2,
                focus: vec![104],
                target: Vec::new(),
                conclusions: vec![(104, 1), (1, 1)],
            },
        ];
        engine.set_puzzles(vec![p]);
        let u = user(1);
        started(&mut engine, u, START);

        // Everything matches the pairs: no mistake, and step 0 is fully applied so step 1 is served
        assert_eq!(probe(&mut engine, u, &[(1, 1), (100, 2), (102, 0)]), 1);

        // Values differing from the pairs, and a key the puzzle does not have, are all mistakes
        match engine
            .reserve_hint(u, GAME, NUMBER, 1, &[(100, 1), (102, 0), (104, 0), (0, 1)], 0, START)
            .unwrap()
        {
            HintPrepared::Mistake(r) => {
                assert!(r.hint.mistake);
                assert_eq!(r.hint.hint.focus, vec![0]);
                assert!(r.hint.hint.conclusions.is_empty());
                assert_eq!(r.hints_used, 0);
            }
            _ => panic!("expected a mistake hint"),
        }

        // All pairs filled: nothing left to hint
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[(1, 1), (100, 2), (102, 0), (104, 1)], 0, START),
            OCErrorCode::ItemNotFound,
        );

        // A puzzle without pairs (pushed before they existed) still indexes the bytes
        let mut engine = new_engine();
        started(&mut engine, u, START);
        assert!(engine.puzzle(GAME).unwrap().solution_pairs.is_empty());
        match engine
            .reserve_hint(u, GAME, NUMBER, 1, &[(1, 1), (100, 2)], 0, START)
            .unwrap()
        {
            HintPrepared::Mistake(r) => assert_eq!(r.hint.hint.focus, vec![1]),
            _ => panic!("expected a mistake hint"),
        }
    }

    #[test]
    fn hint_serves_first_step_with_an_unfilled_conclusion() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        assert_eq!(probe(&mut engine, u, &[]), 0);

        // Step 0 fully applied: move on to step 1
        assert_eq!(probe(&mut engine, u, &[(0, 1), (2, 0)]), 1);

        // Step 0's bulb is placed but its "no bulb" is not: the player has made the move, so
        // move on rather than charging them to be told to tick off a square they ruled out.
        assert_eq!(probe(&mut engine, u, &[(0, 1)]), 1);

        // Every positive placed: only negatives are left anywhere, so the fallback kicks in and
        // serves the earliest step still carrying one (step 0's "no bulb" at index 2).
        assert_eq!(probe(&mut engine, u, &[(0, 1), (6, 1), (8, 1)]), 0);

        // Step 3 concludes nothing but a negative, so it is never chosen while a positive is
        // outstanding anywhere, even though the player has finished steps 0 to 2.
        assert_eq!(probe(&mut engine, u, &[(0, 1), (2, 0), (6, 1)]), 2);

        // Everything filled: nothing to hint
        let all = [(0, 1), (2, 0), (6, 1), (8, 1), (5, 0)];
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &all, 0, START),
            OCErrorCode::ItemNotFound,
        );
    }

    #[test]
    fn hint_upgrade_charges_the_difference_and_keeps_step_count() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let (step, r) = serve(&mut engine, u, 1, &[], 25);
        assert_eq!(r.hints_used, 1);
        assert_eq!(r.hint.level, 1);

        // Upgrading that step to level 3 costs 200 - 25, not 200, and counts no new step
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 3, &[], 200, START),
            OCErrorCode::PriceMismatch,
        );
        let (upgraded, r) = serve(&mut engine, u, 3, &[], 175);
        assert_eq!(upgraded, step);
        assert_eq!(r.hints_used, 1);
        assert_eq!(r.hint.level, 3);
        let state = state(&engine, u, START);
        assert_eq!(state.hints.len(), 1);
        assert_eq!(state.hints[0].level, 3);

        // Asking for a lower level of the same step re-serves it free, no price check
        match engine.reserve_hint(u, GAME, NUMBER, 2, &[], 999, START).unwrap() {
            HintPrepared::AlreadyServed(r) => assert_eq!(r.hint.level, 3),
            _ => panic!("expected a re-serve"),
        }
    }

    #[test]
    fn hint_new_step_after_cap_errors_but_upgrades_still_work() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        serve(&mut engine, u, 1, &[], 25);
        serve(&mut engine, u, 1, &[(0, 1), (2, 0)], 25);

        // max_hints = 2: a third step is refused, an upgrade of a served step still works
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[(0, 1), (2, 0), (6, 1)], 25, START),
            OCErrorCode::Throttled,
        );
        let (step, _) = serve(&mut engine, u, 2, &[(0, 1), (2, 0)], 50);
        assert_eq!(step, 1);

        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 0, &[], 0, START),
            OCErrorCode::InvalidRequest,
        );
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 4, &[], 0, START),
            OCErrorCode::InvalidRequest,
        );
        let too_many = vec![(0u16, 1u8); engine.puzzle(GAME).unwrap().solution.len() + 1];
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &too_many, 0, START),
            OCErrorCode::InvalidRequest,
        );
    }

    #[test]
    fn hint_refused_before_start_and_after_solve() {
        let mut engine = new_engine();
        let u = user(1);
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[], 0, START),
            OCErrorCode::InvalidRequest,
        );
        started(&mut engine, u, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        engine.submit(u, GAME, NUMBER, &solution, START).unwrap();
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[], 0, START),
            OCErrorCode::AlreadyAwarded,
        );
    }

    #[test]
    fn hint_levels_withhold_what_has_not_been_paid_for() {
        let mut engine = DailyPuzzleEngine::default();
        let mut p = puzzle(NUMBER, true);
        // Step 0's target points at its own conclusion, as slant, tents and loopy steps do; step
        // 1's points elsewhere, as light_up's do
        p.hints[0].target = vec![0];
        p.hints[1].target = vec![1];
        engine.set_puzzles(vec![p]);
        let u = user(1);
        started(&mut engine, u, START);

        let (_, r) = serve(&mut engine, u, 1, &[], 25);
        assert_eq!(r.hint.hint.technique, 0);
        assert!(r.hint.hint.target.is_empty());
        assert!(r.hint.hint.conclusions.is_empty());
        assert_eq!(r.hint.hint.focus, vec![4]);

        // Level 2 buys the technique, but not a target that names what the step concludes
        let (_, r) = serve(&mut engine, u, 2, &[], 50);
        assert_eq!(r.hint.hint.technique, 1);
        assert!(r.hint.hint.target.is_empty());
        assert!(r.hint.hint.conclusions.is_empty());

        // Level 3 is the whole thing
        let (_, r) = serve(&mut engine, u, 3, &[], 125);
        assert_eq!(r.hint.hint.technique, 1);
        assert_eq!(r.hint.hint.target, vec![0]);
        assert_eq!(r.hint.hint.conclusions, vec![(0, 1), (2, 0)]);

        // A target that names something other than the conclusion survives at level 2
        let (_, r) = serve(&mut engine, u, 2, &[(0, 1), (2, 0)], 75);
        assert_eq!(r.hint.hint.technique, 2);
        assert_eq!(r.hint.hint.target, vec![1]);
        assert!(r.hint.hint.conclusions.is_empty());
    }

    // One wrong key, never the set: `filled` is client-supplied and can cover the whole board, so
    // returning every disagreement would answer the puzzle in a single free call
    #[test]
    fn hint_mistake_returns_only_the_lowest_wrong_key() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let whole_board: Vec<(u16, u8)> = (0..9).map(|k| (k, 1)).collect();
        match engine.reserve_hint(u, GAME, NUMBER, 1, &whole_board, 0, START).unwrap() {
            HintPrepared::Mistake(r) => {
                // Solution is [1, 0, 0, 0, 0, 0, 1, 0, 1], so every key but 0, 6 and 8 disagrees
                assert_eq!(r.hint.hint.focus, vec![1]);
                assert_eq!(r.hints_used, 0);
            }
            _ => panic!("expected a mistake hint"),
        }
    }

    // The step is reserved by `reserve_hint` itself, so requests that overlap on the debit's await
    // each see what the last one took rather than all reading the same pre-debit count. The hint
    // is not in state until the debit lands: `fetch` is a query, and would otherwise hand the
    // conclusions to a caller whose debit is about to be refused.
    #[test]
    fn reserved_hints_count_before_the_debit_but_are_not_readable() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let step = match engine.reserve_hint(u, GAME, NUMBER, 2, &[], 75, START).unwrap() {
            HintPrepared::Serve { step, .. } => {
                assert!(state(&engine, u, START).hints.is_empty());
                step
            }
            _ => panic!("expected a serve"),
        };

        // max_hints is 2 and one is now taken, so a second new step is the last one allowed
        serve(&mut engine, u, 1, &[(0, 1), (2, 0)], 25);
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[(0, 1), (2, 0), (6, 1)], 25, START),
            OCErrorCode::Throttled,
        );

        // A failed debit puts the step back, budget included
        engine.release_hint(u, GAME, NUMBER, step, 2);
        assert_eq!(state(&engine, u, START).hints.len(), 1);
        let (step, _) = serve(&mut engine, u, 1, &[(0, 1), (2, 0), (6, 1)], 25);
        assert_eq!(step, 2);
    }

    // The hint the caller is buying belongs in that caller's own response, and nowhere a query
    // can reach until it is paid for
    #[test]
    fn the_reserving_caller_sees_the_hint_it_is_buying() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let (step, result) = match engine.reserve_hint(u, GAME, NUMBER, 3, &[], 200, START).unwrap() {
            HintPrepared::Serve { step, result, .. } => (step, result),
            _ => panic!("expected a serve"),
        };
        assert!(!result.hint.hint.conclusions.is_empty());
        assert_eq!(result.state.hints.len(), 1);
        assert_eq!(result.state.hints[0].level, 3);
        assert!(state(&engine, u, START).hints.is_empty());

        engine.confirm_hint(u, GAME, NUMBER, step, 3);
        let hints = state(&engine, u, START).hints;
        assert_eq!(hints.len(), 1);
        assert_eq!(hints[0].level, 3);
    }

    // A step holds one reservation. Letting a second call overwrite it loses whichever hint the
    // first call was paying for: `confirm_hint` looks for its own level and finds another's.
    #[test]
    fn a_second_reservation_on_a_step_in_flight_is_refused() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        // Call A reserves the step at level 1 and its debit is still in flight
        let step = match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
            HintPrepared::Serve { step, .. } => step,
            _ => panic!("expected a serve"),
        };

        // Call B tries the same step at level 2 while A is unresolved. Nothing is served yet, so
        // the price is the full level 2 one rather than the upgrade difference.
        let Err(error) = engine.reserve_hint(u, GAME, NUMBER, 2, &[], 75, START) else {
            panic!("a second reservation on the same step should be refused");
        };
        assert!(error.matches_code(OCErrorCode::Throttled), "{error:?}");

        // A's reservation is untouched, so its debit still confirms the hint it paid for
        engine.confirm_hint(u, GAME, NUMBER, step, 1);
        let hints = state(&engine, u, START).hints;
        assert_eq!(hints.len(), 1);
        assert_eq!(hints[0].level, 1);
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 1);

        // And the upgrade goes through once nothing is in flight
        match engine.reserve_hint(u, GAME, NUMBER, 2, &[], 50, START).unwrap() {
            HintPrepared::Serve { step: s, level, .. } => engine.confirm_hint(u, GAME, NUMBER, s, level),
            _ => panic!("expected a serve"),
        };
        let hints = state(&engine, u, START).hints;
        assert_eq!(hints.len(), 1);
        assert_eq!(hints[0].level, 2);
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 1);
    }

    // An upgrade that fails to pay leaves the level the player already had, and never shows the
    // level they were buying
    #[test]
    fn released_upgrade_leaves_the_level_already_paid_for() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        serve(&mut engine, u, 1, &[], 25);

        let step = match engine.reserve_hint(u, GAME, NUMBER, 3, &[], 175, START).unwrap() {
            HintPrepared::Serve { step, .. } => step,
            _ => panic!("expected an upgrade"),
        };
        assert_eq!(state(&engine, u, START).hints[0].level, 1);

        engine.release_hint(u, GAME, NUMBER, step, 3);
        let hints = state(&engine, u, START).hints;
        assert_eq!(hints.len(), 1);
        assert_eq!(hints[0].level, 1);
    }

    #[test]
    fn released_start_leaves_no_record() {
        let mut engine = new_engine();
        let u = user(2);
        seed_solved(&mut engine, u, &[NUMBER - 10]);

        assert!(matches!(
            engine.reserve_start(u, GAME, NUMBER, 100, START),
            Ok(StartPrepared::Start { fee: 100, .. })
        ));
        assert!(state(&engine, u, START).started_at.is_some());

        engine.release_start(u, GAME, NUMBER);
        assert!(state(&engine, u, START).started_at.is_none());

        // A confirmed start is never released: a retry that raced the debit keeps its record
        assert!(matches!(
            engine.reserve_start(u, GAME, NUMBER, 100, START),
            Ok(StartPrepared::Start { fee: 100, .. })
        ));
        engine.confirm_start(u, GAME, NUMBER);
        engine.release_start(u, GAME, NUMBER);
        assert!(state(&engine, u, START).started_at.is_some());
    }

    // A solve nobody could have played is still paid, because CHIT buys nothing and a cheat only
    // cheats itself, but it never reaches the index that cards are verified against
    #[test]
    fn solves_under_the_carding_floor_pay_but_are_not_published() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();

        let outcome = engine.submit(u, GAME, NUMBER, &solution, START + 200).unwrap();
        assert_eq!(outcome.solved.reward, 250);
        assert_eq!(outcome.solved.solve_time_ms, 200);
        assert!(outcome.result.is_none());
        assert_eq!(state(&engine, u, START).streak, 1);

        let mut engine = new_engine();
        started(&mut engine, u, START);
        let outcome = engine.submit(u, GAME, NUMBER, &solution, START + 10_000).unwrap();
        assert!(outcome.result.is_some());
    }

    #[test]
    fn save_grid_rules() {
        let mut engine = new_engine();
        let u = user(1);
        assert_err(
            engine.save_grid(u, GAME, NUMBER, vec![0; 9], START),
            OCErrorCode::InvalidRequest,
        );
        started(&mut engine, u, START);
        assert_err(
            engine.save_grid(u, GAME, NUMBER, vec![0; 8], START),
            OCErrorCode::InvalidRequest,
        );
        engine
            .save_grid(u, GAME, NUMBER, vec![1, 0, 0, 0, 0, 0, 0, 0, 0], START + 10)
            .unwrap();
        let state = state(&engine, u, START);
        assert_eq!(state.grid, vec![1, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(state.grid_saved_at, Some(START + 10));

        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        engine.submit(u, GAME, NUMBER, &solution, START).unwrap();
        assert_err(
            engine.save_grid(u, GAME, NUMBER, vec![0; 9], START),
            OCErrorCode::AlreadyAwarded,
        );
        assert_err(engine.save_grid(u, GAME, NUMBER + 1, vec![0; 9], START), OCErrorCode::Expired);
    }

    #[test]
    fn new_puzzle_number_drops_records_but_keeps_solved_sets() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        engine.submit(u, GAME, NUMBER, &solution, START).unwrap();
        assert_eq!(engine.metrics().users_with_records, 1);
        assert_eq!(engine.metrics().users_who_have_solved, 1);
        assert_eq!(engine.metrics().games, vec![GAME.to_string()]);

        // Same number re-pushed (config change): records survive
        assert!(!engine.set_puzzles(vec![puzzle(NUMBER, true)]));
        assert_eq!(engine.metrics().users_with_records, 1);

        assert!(engine.set_puzzles(vec![puzzle(NUMBER + 1, true)]));
        assert_eq!(engine.metrics().users_with_records, 0);
        assert_eq!(engine.metrics().users_who_have_solved, 1);
        assert_eq!(engine.metrics().number, Some(NUMBER + 1));

        let tomorrow = START + DAY_IN_MS;
        let state = state(&engine, u, tomorrow);
        assert_eq!(state.started_at, None);
        assert_eq!(state.streak, 1);
        assert!(state.has_solved_before);
        assert_eq!(engine.entry_fee(u, engine.puzzle(GAME).unwrap()), 100);
        assert!(!engine.is_stale(tomorrow));
        assert!(engine.is_stale(tomorrow + DAY_IN_MS));

        // An empty push is "nothing for the current number" and changes nothing. Taken as a day
        // change it would clear every puzzle and every in-progress record, entry fees included.
        let fee = engine.entry_fee(u, engine.puzzle(GAME).unwrap());
        engine.reserve_start(u, GAME, NUMBER + 1, fee, tomorrow).unwrap();
        engine.confirm_start(u, GAME, NUMBER + 1);
        assert!(!engine.set_puzzles(Vec::new()));
        assert_eq!(engine.metrics().number, Some(NUMBER + 1));
        assert_eq!(engine.metrics().games, vec![GAME.to_string()]);
        assert_eq!(engine.metrics().users_with_records, 1);
        assert!(!engine.is_stale(tomorrow));
    }

    #[test]
    fn chit_keys_do_not_identify_the_puzzle() {
        let engine = new_engine();
        assert_eq!(engine.entry_key(GAME, NUMBER), format!("{GAME}:{NUMBER}:entry"));
        assert_eq!(engine.solve_key(GAME, NUMBER), format!("{GAME}:{NUMBER}:solve"));
        assert_eq!(engine.hint_key(GAME, NUMBER, 12, 3), format!("{GAME}:{NUMBER}:hint:12:3"));
        assert!(engine.hint_key(GAME, NUMBER, u16::MAX, 3).len() <= 64);
    }

    // Regenerating a day drops the records made against the old puzzle, so every call is made
    // again. The keys must not move with the puzzle, or the replay would charge a second entry
    // fee and pay a second reward to someone who had already solved that day.
    #[test]
    fn regenerated_puzzle_keeps_the_same_chit_keys() {
        let mut engine = new_engine();
        let before = (
            engine.entry_key(GAME, NUMBER),
            engine.solve_key(GAME, NUMBER),
            engine.hint_key(GAME, NUMBER, 1, 2),
        );

        let mut regenerated = puzzle(NUMBER, true);
        regenerated.description[3] = 1;
        engine.set_puzzles(vec![regenerated]);

        assert_eq!(engine.entry_key(GAME, NUMBER), before.0);
        assert_eq!(engine.solve_key(GAME, NUMBER), before.1);
        assert_eq!(engine.hint_key(GAME, NUMBER, 1, 2), before.2);
    }

    // Same number, same game, new content: only that game's records go, solves stay credited
    #[test]
    fn regenerated_puzzle_drops_that_games_records_only() {
        let mut engine = new_engine();
        engine.set_puzzles(vec![puzzle(NUMBER, true), puzzle_for(OTHER, NUMBER, true)]);
        let u = user(1);
        started(&mut engine, u, START);
        started_game(&mut engine, u, OTHER, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        engine.submit(u, GAME, NUMBER, &solution, START).unwrap();
        assert!(state_for(&engine, u, GAME, START).solved.is_some());
        assert!(state_for(&engine, u, OTHER, START).started_at.is_some());

        // Identical re-push (config change): nothing dropped
        assert!(!engine.set_puzzles(vec![puzzle(NUMBER, true), puzzle_for(OTHER, NUMBER, true)]));
        assert!(state_for(&engine, u, GAME, START).solved.is_some());
        assert!(state_for(&engine, u, OTHER, START).started_at.is_some());

        let mut regenerated = puzzle(NUMBER, true);
        regenerated.description[3] = 1;
        assert!(engine.set_puzzles(vec![regenerated, puzzle_for(OTHER, NUMBER, true)]));
        let game = state_for(&engine, u, GAME, START);
        assert_eq!(game.started_at, None);
        assert!(game.solved.is_none());
        assert!(game.has_solved_before);
        assert_eq!(game.streak, 1);
        assert!(state_for(&engine, u, OTHER, START).started_at.is_some());
        assert_eq!(engine.metrics().users_who_have_solved, 1);
        assert_eq!(engine.metrics().users_with_records, 1);

        // A second push of the regenerated puzzle drops nothing further
        let mut again = puzzle(NUMBER, true);
        again.description[3] = 1;
        assert!(!engine.set_puzzles(vec![again, puzzle_for(OTHER, NUMBER, true)]));
        assert!(state_for(&engine, u, OTHER, START).started_at.is_some());
    }

    // Same number, different game: the vanished game's records go, the surviving game's stay
    #[test]
    fn replaced_game_drops_the_vanished_games_records() {
        let mut engine = new_engine();
        engine.set_puzzles(vec![puzzle(NUMBER, true), puzzle_for(OTHER, NUMBER, true)]);
        let u = user(1);
        started(&mut engine, u, START);
        started_game(&mut engine, u, OTHER, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        engine.submit(u, GAME, NUMBER, &solution, START).unwrap();

        assert!(engine.set_puzzles(vec![puzzle_for(OTHER, NUMBER, true), puzzle_for("third", NUMBER, true)]));
        assert_eq!(engine.metrics().games, vec![OTHER.to_string(), "third".to_string()]);
        assert!(state_for(&engine, u, OTHER, START).started_at.is_some());
        assert_eq!(state_for(&engine, u, "third", START).started_at, None);
        assert!(engine.record(u, GAME, NUMBER).is_none());
        assert_eq!(engine.metrics().users_who_have_solved, 1);
        assert_eq!(engine.history.get(&u).unwrap().last_solved, Some(NUMBER));

        // GAME comes back with its original content: a fresh start, the earlier solve still credited
        assert!(!engine.set_puzzles(vec![puzzle(NUMBER, true), puzzle_for(OTHER, NUMBER, true)]));
        let game = state_for(&engine, u, GAME, START);
        assert_eq!(game.started_at, None);
        assert!(game.has_solved_before);
        assert!(state_for(&engine, u, OTHER, START).started_at.is_some());
    }
}
