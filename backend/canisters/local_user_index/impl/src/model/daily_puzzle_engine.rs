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
// `{number}:entry`, `{number}:solve` and `{game_id}:{number}:hint:{step}:{level}`. The entry and
// solve keys deliberately identify neither the puzzle nor the game: a day holds one puzzle, and a
// `regenerate_today` replaces it, possibly with a different game, and drops the records made
// against the old one, so every call is made again. With the puzzle or the game in the key, the
// replay would charge a second entry fee and, worse, pay a second full reward to someone who had
// already solved that day. Without it the user canister answers `AlreadyAdded`, which the
// endpoints treat as applied, so a regenerated day is a free restart and pays out once. The user
// canister scopes its keys by the `game_id` it is sent, so entry and solve go under
// `DAILY_PUZZLE_CHIT_GAME_ID` rather than the day's game for the same reason. Hints are bought
// per step of a particular puzzle, so those keys do name the game and are sent under it. Longest
// key in practice is around 26 bytes, well under the user canister's 64-byte limit.
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
}

impl UserHistory {
    // Folds in a history kept for the same user under another id. Each ends in a run of solved
    // days; the later run is the one that counts, and it reaches back over the earlier one if the
    // two meet.
    fn merge(&mut self, other: UserHistory) {
        if let Some(theirs) = other.last_solved {
            match self.last_solved {
                None => {
                    self.last_solved = Some(theirs);
                    self.streak = other.streak;
                }
                Some(mine) => {
                    let (later, earlier) = if mine >= theirs {
                        ((mine, self.streak), (theirs, other.streak))
                    } else {
                        ((theirs, other.streak), (mine, self.streak))
                    };
                    let run_start = |(last, streak): (PuzzleNumber, u32)| (last + 1).saturating_sub(streak);
                    let start = if earlier.0 + 1 >= run_start(later) {
                        run_start(later).min(run_start(earlier))
                    } else {
                        run_start(later)
                    };
                    self.last_solved = Some(later.0);
                    self.streak = later.0 + 1 - start;
                }
            }
        }
        // The free play was spent on whichever came first. A history which started before
        // `first_started` existed spent it on some earlier day, which None, as the lesser, keeps.
        self.first_started = match (self.ever_started, other.ever_started) {
            (true, true) => self.first_started.min(other.first_started),
            (true, false) => self.first_started,
            (false, _) => other.first_started,
        };
        self.ever_started |= other.ever_started;
    }
}

// Everything the engine holds for one user, taken from under a migrated user's old id to be
// folded in under their new one, by whichever LocalUserIndex holds it. Sent between them msgpack
// serialized.
#[derive(Serialize, Deserialize)]
pub struct DailyPuzzleUser {
    #[serde(default)]
    history: Option<UserHistory>,
    #[serde(default)]
    games: BTreeMap<GameId, UserGame>,
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
    // A step this user already has: re-served free, whatever level an old client asks for
    AlreadyServed(HintResult),
    // The step is already reserved against the user by the time this is returned, so the cap
    // cannot be walked past by calls that overlap on the debit's await. Only the reservation is
    // stored: the hint itself reaches state in `confirm_hint`, once it is paid for. The endpoint
    // calls exactly one of `confirm_hint` / `release_hint` with the same step.
    Serve {
        step: u16,
        result: HintResult,
        price: u32,
        // The CHIT idempotency key for the debit
        key: String,
        // Whether `reserve_hint` spent a free check on this call. Passed back to `confirm_hint`,
        // which gives it back once the hint is paid for; a debit that fails keeps it spent.
        metered: bool,
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

/// The level every hint is served at now (see `ServedHint::level`): one level, the step's outline
/// and its sentence, never its answer.
pub const HINT_LEVEL: u8 = 2;

/// The keys the board draws conclusion `key` of hint `step` on (`DailyPuzzle::hint_settles`). The
/// conclusion key itself in every game but Bridges, whose conclusions are gaps between islands
/// while its focus and target are cells; also the fallback for puzzles pushed without the mapping.
fn drawn_on(puzzle: &DailyPuzzle, step: usize, key: u16) -> Vec<u16> {
    match puzzle.hint_settles.get(step).filter(|s| !s.is_empty()) {
        Some(settles) => settles.iter().filter(|(k, _)| *k == key).map(|(_, d)| *d).collect(),
        None => vec![key],
    }
}

/// Hint `step` as the client sees it: the region the deduction looked at, the technique so the
/// client can render its sentence, and the keys that sentence points at. Never the conclusions,
/// which are the answer (#9675 H1).
///
/// `technique` 0 (in records sold before hints had one level) means withheld: no game's
/// `Technique` enum uses 0, they all start at 1.
///
/// `target` is dropped when it names a key the board draws a conclusion on (#9675 H5: compared as
/// drawn keys, so Bridges' gap conclusions are matched against its cells). Some steps point at
/// the cells they fill, and sending that would hand over the answer. An empty `target` already
/// means "paint the whole of `focus`", so the client needs no new case. `focus` is never filtered:
/// it is a region the player can usually reconstruct from the rules, so punching the answer out
/// of it would point straight at the answer. It is sorted, though: the generators build it in
/// deduction order, several with the concluded key first or last, and the order would name it.
fn served_hint(puzzle: &DailyPuzzle, step: usize) -> PuzzleHint {
    let hint = &puzzle.hints[step];
    let drawn: BTreeSet<u16> = hint
        .conclusions
        .iter()
        .flat_map(|(k, _)| drawn_on(puzzle, step, *k))
        .collect();
    let mut focus = hint.focus.clone();
    focus.sort_unstable();
    PuzzleHint {
        technique: hint.technique,
        focus,
        target: if hint.target.iter().any(|k| drawn.contains(k)) { Vec::new() } else { hint.target.clone() },
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

    pub fn entry_key(&self, number: PuzzleNumber) -> String {
        format!("{number}:entry")
    }

    pub fn solve_key(&self, number: PuzzleNumber) -> String {
        format!("{number}:solve")
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

        let fee = self.entry_fee(user_id, puzzle);
        let key = self.entry_key(number);

        if let Some(record) = self.record(user_id, game_id, number) {
            if record.entry_paid {
                return Ok(StartPrepared::AlreadyStarted(StartResult {
                    started_at: record.started_at,
                    state: self.user_state(user_id, puzzle),
                    chit_balance: None,
                    total_chit_earned: None,
                }));
            }
            // The record exists but its fee never landed: the debit is still in flight, or its
            // callback trapped and neither `confirm_start` nor `release_start` ran. Either way the
            // start is issued again with the same key. A fee that did land answers `AlreadyAdded`,
            // which confirms the record; one that did not is debited now; a concurrent first call
            // that is later refused releases a record this call then confirms, so the two cannot
            // leave it unpaid. Answering `AlreadyStarted` here instead locked the user out of the
            // game for the day, with the fee gone.
            if fee != expected_entry_fee {
                return Err(OCErrorCode::PriceMismatch.into());
            }
            let started_at = record.started_at;
            if fee == 0 {
                // Nothing to debit, so nothing for the endpoint to confirm: settle it here
                self.confirm_start(user_id, game_id, number);
            }
            let puzzle = self.available(game_id, number, now)?;
            let result = StartResult {
                started_at,
                state: self.user_state(user_id, puzzle),
                chit_balance: None,
                total_chit_earned: None,
            };
            return Ok(if fee == 0 {
                StartPrepared::AlreadyStarted(result)
            } else {
                StartPrepared::Start { fee, key, result }
            });
        }

        if fee != expected_entry_fee {
            return Err(OCErrorCode::PriceMismatch.into());
        }

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
            // `create_record` marked the user's first play before the debit; a start that never
            // happened must not spend it
            if let Some(history) = self.history.get_mut(&user_id)
                && history.first_started == Some(number)
                && history.last_solved.is_none()
            {
                history.ever_started = false;
                history.first_started = None;
            }
        }
        if games.is_empty() {
            self.user_games.remove(&user_id);
        }
    }

    // The user's account is gone, and with it every reason to hold what they did
    pub fn remove_user(&mut self, user_id: UserId) {
        self.user_games.remove(&user_id);
        self.history.remove(&user_id);
    }

    // The user has been migrated to a new id, and what they did goes with them
    pub fn take_user(&mut self, user_id: UserId) -> Option<DailyPuzzleUser> {
        let history = self.history.remove(&user_id);
        let games = self.user_games.remove(&user_id).unwrap_or_default();
        (history.is_some() || !games.is_empty()).then_some(DailyPuzzleUser { history, games })
    }

    // Folds in what was held for a migrated user under their old id. They may have played under
    // their new id before it arrived, so the histories are merged, and a game they have a record
    // of under both keeps the one made under the new id.
    pub fn import_user(&mut self, user_id: UserId, user: DailyPuzzleUser) {
        if let Some(history) = user.history {
            self.history.entry(user_id).or_default().merge(history);
        }
        // Records for another day are dropped, as `set_puzzles` drops them
        for (game_id, game) in user.games {
            if Some(game.number) == self.number {
                self.user_games.entry(user_id).or_default().entry(game_id).or_insert(game);
            }
        }
    }

    pub fn user_ids(&self) -> BTreeSet<UserId> {
        self.history.keys().chain(self.user_games.keys()).copied().collect()
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
        // anything branches on what the solution says, and given back in `confirm_hint` once a
        // paid hint has actually been paid for. Metering each outcome where it is raised instead
        // left the two raised before the first check - the hint cap, and a call with no step
        // outstanding - free, and a free refusal that only happens when the named keys are right
        // is the whole oracle: at the cap, every wrong guess costs a check and every right one
        // costs nothing. Refunding at the reservation had the same hole one step later: a debit
        // the user cannot afford is refused only when the keys were right.
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
        //
        // A wrong placement (a non-zero value: a line, bulb, tent, bridge or CHAT) is named before
        // a wrong "no" mark, whatever their keys. The placement is usually the cause and the "no"
        // its consequence: CHAT Rooms sends the cells a placed CHAT rules out as "no" marks, so a
        // wrong CHAT puts a false "no" on the true CHAT beside it (CHAT Rooms invariant 21).
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
            .min_by_key(|(k, v)| (*v == 0, *k))
            .map(|(k, _)| *k);
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
        let (mut step, mut hint) = puzzle
            .hints
            .iter()
            .enumerate()
            .find(|(_, h)| positive_outstanding(h))
            .or_else(|| puzzle.hints.iter().enumerate().find(|(_, h)| outstanding(h)))
            .ok_or(OCErrorCode::ItemNotFound)?;
        // A skipped negatives-only step is not always bookkeeping: a later step can rest on it
        // (Light Up's "every free cell next to this 1" once set exclusion has ruled two of three
        // out). Served alone, that step reads as wrong, so serve its premise first: the earliest
        // negatives-only step with an unfilled conclusion on a key the step looks at, and that
        // step's own premise in turn (#9588 invariant 1). The walk stops at a step already bought:
        // a mark taken back off the board would otherwise sell its premise as a new step in place
        // of the one paid for (#9588 invariant 4). A step whose first level is still being paid
        // for counts as bought.
        let started = |step: usize| {
            record
                .hints
                .iter()
                .any(|e| e.step as usize == step && (e.served.is_some() || e.pending_level.is_some()))
        };
        // The premise's conclusions are compared with this step's focus as the keys the board draws
        // them on: in Bridges a conclusion is a gap while the focus is cells (#9675 H5)
        while !started(step)
            && let Some(premise) = puzzle.hints[..step].iter().enumerate().find(|(i, h)| {
                h.conclusions.iter().all(|c| c.1 == 0)
                    && h.conclusions
                        .iter()
                        .any(|c| !filled_set.contains(c) && drawn_on(puzzle, *i, c.0).iter().any(|k| hint.focus.contains(k)))
            })
        {
            (step, hint) = premise;
        }

        // One level: a step this user already has is re-served free, whatever level an old client
        // asks for (#9675 H2), and a new one costs the one price (#9675 H3)
        let served_step = step;
        let step = step as u16;
        let price = puzzle
            .game_config
            .hint_prices
            .first()
            .copied()
            .ok_or_else(|| OCErrorCode::InvalidRequest.with_message("hint_prices"))?;

        match record.hints.iter().find(|e| e.step == step).and_then(|e| e.served.as_ref()) {
            Some(served) => {
                return Ok(HintPrepared::AlreadyServed(HintResult {
                    hint: served.clone(),
                    hints_used: hints_paid(record),
                    state: self.user_state(user_id, puzzle),
                    chit_balance: None,
                    total_chit_earned: None,
                }));
            }
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
            hint: served_hint(puzzle, served_step),
            level: HINT_LEVEL,
            mistake: false,
        };
        let key = self.hint_key(game_id, number, step, HINT_LEVEL);
        let result = self.reserve_step(user_id, game_id, number, step, &served, now)?;

        Ok(HintPrepared::Serve {
            step,
            result,
            price,
            key,
            metered,
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
    fn reserve_step(
        &mut self,
        user_id: UserId,
        game_id: &str,
        number: PuzzleNumber,
        step: u16,
        served: &ServedHint,
        now: TimestampMillis,
    ) -> OCResult<HintResult> {
        let record = self
            .user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)
            .ok_or_else(not_started)?;

        if let Some(entry) = record.hints.iter_mut().find(|e| e.step == step) {
            // A step holds one reservation. A second call could otherwise `release_hint` the entry
            // the first is about to confirm.
            if entry.pending_level.is_some() {
                return Err(OCErrorCode::Throttled.with_message("hint in flight"));
            }
            entry.pending_level = Some(HINT_LEVEL);
            entry.pending_since = now;
        } else {
            record.hints.push(HintEntry {
                step,
                served: None,
                pending_level: Some(HINT_LEVEL),
                pending_since: now,
            });
            record.hint_steps_used = record.hint_steps_used.saturating_add(1);
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

    // Writes the paid-for hint into state. `refund_check` is the `metered` flag from
    // the reservation: the check `reserve_hint` took is given back here, once the hint has been
    // paid for, so that a debit refused for want of CHIT stays metered like every other refusal.
    pub fn confirm_hint(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber, step: u16, refund_check: bool) {
        let Some(hint) = self
            .puzzles
            .get(game_id)
            .filter(|p| p.number == number)
            .filter(|p| (step as usize) < p.hints.len())
            .map(|p| served_hint(p, step as usize))
        else {
            return;
        };
        let Some(entry) = self.entry_pending_at(user_id, game_id, number, step) else {
            return;
        };
        entry.pending_level = None;
        if entry.served.is_none() {
            entry.served = Some(ServedHint {
                hint,
                level: HINT_LEVEL,
                mistake: false,
            });
        }
        if refund_check && let Some(record) = self.user_games.get_mut(&user_id).and_then(|m| m.get_mut(game_id)) {
            record.free_checks = record.free_checks.saturating_sub(1);
        }
    }

    // Undoes `reserve_hint` when the debit did not go through. Only the reservation is dropped: a
    // step already paid for keeps both its hint and its place in the count.
    pub fn release_hint(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber, step: u16) {
        let Some(entry) = self.entry_pending_at(user_id, game_id, number, step) else {
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

    fn entry_pending_at(&mut self, user_id: UserId, game_id: &str, number: PuzzleNumber, step: u16) -> Option<&mut HintEntry> {
        self.user_games
            .get_mut(&user_id)
            .and_then(|m| m.get_mut(game_id))
            .filter(|r| r.number == number)?
            .hints
            .iter_mut()
            .find(|e| e.step == step && e.pending_level.is_some())
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
            // The free play was spent today and its record is gone - which is what a
            // `regenerate_today` leaves behind, whether or not it swapped the game. A free entry
            // pays no CHIT and so records no `{number}:entry` key on the user canister, which is
            // what makes a replayed entry free; without this the replacement puzzle would charge
            // the full fee to the one player whose free play it was. A day holds one puzzle, so
            // there is no second game today for the waiver to leak onto.
            Some(h) if h.first_started == Some(puzzle.number) => 0,
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
            hint_settles: Vec::new(),
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
    // remembered, the replacement puzzle charges the one player whose free play it was. The
    // waiver is for the day, not the game: a regeneration may swap the game, and a day holds one
    // puzzle, so there is no second game today for it to leak onto.
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
        started(&mut engine, u, START);

        // regenerate_today with another game: same number, the record is dropped again
        assert!(engine.set_puzzles(vec![puzzle_for(OTHER, NUMBER, true)]));
        assert!(engine.record(u, GAME, NUMBER).is_none());
        assert_eq!(state_for(&engine, u, OTHER, START).entry_fee, 0);

        // Tomorrow is not free
        assert_eq!(engine.entry_fee(u, &puzzle(NUMBER + 1, true)), 100);
    }

    // `create_record` spends the free play before the debit. A start whose debit is refused
    // never happened, so the free play must not be spent on it.
    #[test]
    fn a_released_start_does_not_spend_the_first_play() {
        let mut engine = new_engine();
        let u = user(1);
        // Every play costs today, so the first start is a paid one
        let mut paid = puzzle(NUMBER, true);
        paid.config.first_play_free = false;
        engine.set_puzzles(vec![paid]);
        assert!(matches!(
            engine.reserve_start(u, GAME, NUMBER, 100, START),
            Ok(StartPrepared::Start { fee: 100, .. })
        ));
        engine.release_start(u, GAME, NUMBER);
        assert!(engine.record(u, GAME, NUMBER).is_none());

        // Back to a free first play: the released start did not use it up
        engine.set_puzzles(vec![puzzle(NUMBER, true)]);
        assert_eq!(state(&engine, u, START).entry_fee, 0);
    }

    // The record is created before the debit, and neither `confirm_start` nor `release_start`
    // runs if the callback traps. Answering `AlreadyStarted` for it locked the user out for the
    // day; instead the start is issued again with the same key.
    #[test]
    fn an_unpaid_record_is_started_again_not_reported_as_started() {
        let mut engine = new_engine();
        let u = user(1);
        let mut paid = puzzle(NUMBER, true);
        paid.config.first_play_free = false;
        engine.set_puzzles(vec![paid]);

        let first_key = match engine.reserve_start(u, GAME, NUMBER, 100, START).unwrap() {
            StartPrepared::Start { fee: 100, key, .. } => key,
            _ => panic!("expected a paid start"),
        };
        assert!(!engine.record(u, GAME, NUMBER).unwrap().entry_paid);

        // Nothing came back. The next start debits again under the same key, keeps the clock
        match engine.reserve_start(u, GAME, NUMBER, 100, START + 1_000).unwrap() {
            StartPrepared::Start { fee, key, result } => {
                assert_eq!(fee, 100);
                assert_eq!(key, first_key);
                assert_eq!(result.started_at, START);
            }
            _ => panic!("an unpaid record should be started again"),
        }
        assert_err(
            engine.reserve_start(u, GAME, NUMBER, 0, START + 1_000),
            OCErrorCode::PriceMismatch,
        );

        // Paid now, so it is started
        engine.confirm_start(u, GAME, NUMBER);
        assert!(matches!(
            engine.reserve_start(u, GAME, NUMBER, 100, START + 2_000),
            Ok(StartPrepared::AlreadyStarted(_))
        ));

        // An unpaid record whose fee has since become nothing to pay is settled on the spot
        let v = user(2);
        let mut paid = puzzle(NUMBER, true);
        paid.config.first_play_free = false;
        engine.set_puzzles(vec![paid]);
        assert!(matches!(
            engine.reserve_start(v, GAME, NUMBER, 100, START),
            Ok(StartPrepared::Start { fee: 100, .. })
        ));
        let mut free = puzzle(NUMBER, true);
        free.config.entry_fee = 0;
        free.config.first_play_free = false;
        engine.set_puzzles(vec![free]);
        assert!(matches!(
            engine.reserve_start(v, GAME, NUMBER, 0, START),
            Ok(StartPrepared::AlreadyStarted(_))
        ));
        assert!(engine.record(v, GAME, NUMBER).unwrap().entry_paid);
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
        engine.release_hint(u, GAME, NUMBER, step);
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

        let (step, _) = serve(&mut engine, u, 1, &[], 25);
        for _ in 0..engine.puzzle(GAME).unwrap().config.max_free_checks + 1 {
            match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
                HintPrepared::AlreadyServed(r) => assert_eq!(r.hint.level, HINT_LEVEL),
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

    // `confirm_hint` gives the free check back, not the reservation: a debit refused for want of
    // CHIT is a refusal that only happens when the named keys were right, so it has to stay
    // metered like every other refusal
    #[test]
    fn a_hint_whose_debit_fails_keeps_its_check_spent() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let (step, metered) = match engine.reserve_hint(u, GAME, NUMBER, 1, &[(0, 1)], 25, START).unwrap() {
            HintPrepared::Serve { step, metered, .. } => (step, metered),
            _ => panic!("expected a serve"),
        };
        assert!(metered);
        assert_eq!(state(&engine, u, START).free_checks, 1);

        engine.release_hint(u, GAME, NUMBER, step);
        assert_eq!(state(&engine, u, START).free_checks, 1);
        assert!(state(&engine, u, START).hints.is_empty());

        // Paid for, the check comes back
        let (step, metered) = match engine.reserve_hint(u, GAME, NUMBER, 1, &[(0, 1)], 25, START).unwrap() {
            HintPrepared::Serve { step, metered, .. } => (step, metered),
            _ => panic!("expected a serve"),
        };
        assert_eq!(state(&engine, u, START).free_checks, 2);
        engine.confirm_hint(u, GAME, NUMBER, step, metered);
        assert_eq!(state(&engine, u, START).free_checks, 1);
        assert_eq!(state(&engine, u, START).hints.len(), 1);
    }

    // Several generators put the concluded key at a fixed place in `focus`, so its order alone
    // would name the key a hint withholds
    #[test]
    fn served_focus_is_sorted() {
        let mut p = puzzle(NUMBER, true);
        p.hints = vec![PuzzleHint {
            technique: 2,
            focus: vec![8, 1, 5],
            target: Vec::new(),
            conclusions: vec![(8, 1)],
        }];
        assert_eq!(served_hint(&p, 0).focus, vec![1, 5, 8]);
    }

    #[test]
    fn a_migrated_users_history_and_records_move_to_their_new_id() {
        let mut engine = new_engine();
        let (old, new) = (user(1), user(2));
        seed_solved(&mut engine, old, &[NUMBER - 2, NUMBER - 1]);
        started(&mut engine, old, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        engine.submit(old, GAME, NUMBER, &solution, START + 42_000).unwrap();

        let taken = engine.take_user(old).unwrap();
        assert!(engine.take_user(old).is_none());
        assert_eq!(state(&engine, old, START).streak, 0);

        // As sent on to another LocalUserIndex
        let taken: DailyPuzzleUser = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&taken));
        engine.import_user(new, taken);
        let state = state(&engine, new, START);
        assert_eq!(state.streak, 3);
        assert!(state.has_solved_before);
        assert_eq!(state.started_at, Some(START));
        assert_eq!(state.solved.unwrap().streak, 3);
    }

    #[test]
    fn a_migrated_users_history_is_merged_with_what_they_did_under_their_new_id() {
        let fee = new_engine().puzzle(GAME).unwrap().config.entry_fee;
        let old_history = |numbers: &[PuzzleNumber]| {
            let mut engine = new_engine();
            seed_solved(&mut engine, user(1), numbers);
            engine.take_user(user(1)).unwrap()
        };

        // Solved today under the new id, which joins the run that ended yesterday under the old
        let mut engine = new_engine();
        let new = user(2);
        started(&mut engine, new, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();
        engine.submit(new, GAME, NUMBER, &solution, START + 42_000).unwrap();
        assert_eq!(state(&engine, new, START).streak, 1);
        engine.import_user(new, old_history(&[NUMBER - 2, NUMBER - 1]));
        assert_eq!(state(&engine, new, START).streak, 3);
        // Joined either way round
        let mut engine = new_engine();
        seed_solved(&mut engine, new, &[NUMBER - 1, NUMBER]);
        engine.import_user(new, old_history(&[NUMBER - 3, NUMBER - 2, NUMBER - 1]));
        assert_eq!(state(&engine, new, START).streak, 4);

        // A day missed between them breaks the run
        let mut engine = new_engine();
        seed_solved(&mut engine, new, &[NUMBER]);
        engine.import_user(new, old_history(&[NUMBER - 3, NUMBER - 2]));
        assert_eq!(state(&engine, new, START).streak, 1);
        // And a run that ended earlier doesn't replace a later one
        let mut engine = new_engine();
        seed_solved(&mut engine, new, &[NUMBER - 1]);
        engine.import_user(new, old_history(&[NUMBER - 5, NUMBER - 4, NUMBER - 3]));
        assert_eq!(state(&engine, new, START).streak, 1);

        // A record held under both ids keeps the one made under the new id
        let mut engine = new_engine();
        let old = user(1);
        started(&mut engine, old, START);
        let taken = engine.take_user(old).unwrap();
        started(&mut engine, new, START + 1);
        engine.import_user(new, taken);
        assert_eq!(state(&engine, new, START).started_at, Some(START + 1));

        // The free play spent under the old id stays spent
        let mut engine = new_engine();
        assert_eq!(state(&engine, new, START).entry_fee, 0);
        engine.import_user(new, old_history(&[NUMBER - 3]));
        assert_eq!(state(&engine, new, START).entry_fee, fee);
        assert!(state(&engine, new, START).has_solved_before);
        // Including when it was spent before `first_started` was recorded and the user has since
        // started today's game free under their new id: a `regenerate_today` dropping that record
        // doesn't make the replacement free
        let mut engine = new_engine();
        started(&mut engine, new, START);
        engine.import_user(new, old_history(&[NUMBER - 3]));
        engine.user_games.remove(&new);
        assert_eq!(state(&engine, new, START).entry_fee, fee);
    }

    #[test]
    fn a_migrated_users_record_for_another_day_is_dropped() {
        let mut engine = new_engine();
        let (old, new) = (user(1), user(2));
        started(&mut engine, old, START);
        let taken = engine.take_user(old).unwrap();

        engine.set_puzzles(vec![puzzle(NUMBER + 1, true)]);
        engine.import_user(new, taken);
        assert_eq!(engine.metrics().users_with_records, 0);
        assert_eq!(state(&engine, new, START + DAY_IN_MS).entry_fee, 100);
    }

    #[test]
    fn removing_a_user_drops_their_records_and_history() {
        let mut engine = new_engine();
        let u = user(1);
        seed_solved(&mut engine, u, &[NUMBER - 1]);
        started(&mut engine, u, START);
        assert_eq!(engine.metrics().users_with_records, 1);
        assert_eq!(engine.metrics().users_who_have_solved, 1);

        engine.remove_user(u);
        assert_eq!(engine.metrics().users_with_records, 0);
        assert_eq!(engine.metrics().users_who_have_solved, 0);
        assert_eq!(state(&engine, u, START).entry_fee, 0);
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
        // The free play covers the day, so tomorrow is the first paid one
        assert_eq!(engine.entry_fee(v, &puzzle(NUMBER + 1, true)), 100);
    }

    #[test]
    fn hint_penalty_applies_to_every_step_served() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let solution = engine.puzzle(GAME).unwrap().solution.clone();

        // Two steps: the penalty applies to each
        serve(&mut engine, u, 1, &[], 25);
        serve(&mut engine, u, 1, &[(0, 1), (2, 0)], 25);

        let outcome = engine.submit(u, GAME, NUMBER, &solution, START + 10_000).unwrap();
        assert_eq!(outcome.solved.reward, 150);
        assert_eq!(outcome.solved.hints_used, 2);
        assert_eq!(outcome.result.as_ref().unwrap().hints_used, 2);
    }

    #[test]
    fn streak_derivation() {
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
        let (step, result, metered) = match engine.reserve_hint(u, GAME, NUMBER, level, filled, expected_price, START) {
            Ok(HintPrepared::Serve {
                step, result, metered, ..
            }) => (step, result, metered),
            Ok(HintPrepared::Mistake(_)) => panic!("unexpected mistake"),
            Ok(HintPrepared::AlreadyServed(_)) => panic!("unexpected re-serve"),
            Err(e) => panic!("{e:?}"),
        };
        engine.confirm_hint(u, GAME, NUMBER, step, metered);
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
        engine.release_hint(u, GAME, NUMBER, step);
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

    /// #9588 invariant 2: with no premise outstanding, the engine serves the first step with a
    /// positive still to place, otherwise the first step with anything unfilled.
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

    fn hint(technique: u8, focus: &[u16], target: &[u16], conclusions: &[(u16, u8)]) -> PuzzleHint {
        PuzzleHint {
            technique,
            focus: focus.to_vec(),
            target: target.to_vec(),
            conclusions: conclusions.to_vec(),
        }
    }

    fn engine_with_hints(hints: Vec<PuzzleHint>) -> DailyPuzzleEngine {
        let mut engine = DailyPuzzleEngine::default();
        let mut p = puzzle(NUMBER, true);
        p.hints = hints;
        engine.set_puzzles(vec![p]);
        engine
    }

    /// #9588 invariant 1, on the board it was reported from: Light Up #20723 (tricky), with the
    /// player's five bulbs and ten X marks. The first step with a bulb still to place is 15, "the
    /// 1 at 75 needs a bulb in every free cell", whose premise is steps 12 and 14 ruling out 74
    /// and 76. Serving 15 without them told the player to fill three cells round a 1.
    #[test]
    fn hint_serves_the_negatives_a_step_rests_on_first_light_up_20723() {
        let mut engine = DailyPuzzleEngine::default();
        let mut p = puzzle(NUMBER, true);
        p.description = vec![
            1, 10, 10, 16, 0, 0, 0, 18, 0, 0, 17, 0, 0, 18, 18, 0, 0, 0, 0, 18, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 17, 0, 0, 0, 16, 0, 0, 0, 0, 16, 0, 0, 0, 18, 0, 0, 19, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 18, 0, 0, 0, 0, 0, 0, 0, 19, 0, 0, 0, 0, 18, 16, 0, 0, 18, 0, 0, 19, 0, 0, 0, 17,
        ];
        p.solution = vec![
            0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
            0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,
            0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0,
        ];
        // The first 17 steps of the generator's trace, verbatim
        p.hints = vec![
            hint(3, &[10, 11, 0, 20], &[10], &[(20, 1)]),
            hint(2, &[43, 42, 44, 33, 53], &[43], &[(42, 0), (44, 0), (33, 0), (53, 0)]),
            hint(2, &[7, 6, 8, 17], &[7], &[(6, 0), (8, 0), (17, 0)]),
            hint(2, &[99, 98, 89], &[99], &[(98, 0)]),
            hint(1, &[6, 5], &[6], &[(5, 1)]),
            hint(3, &[16, 15, 17, 6, 26], &[16], &[(26, 1)]),
            hint(2, &[4, 3, 5, 14], &[4], &[(3, 0), (14, 0)]),
            hint(4, &[2, 1, 12], &[12], &[(12, 0)]),
            hint(3, &[11, 10, 12, 1, 21], &[11], &[(1, 1)]),
            hint(1, &[13, 12, 14, 15, 3, 23, 33], &[13], &[(13, 1)]),
            hint(4, &[41, 32, 31], &[31], &[(31, 0)]),
            hint(4, &[94, 85, 84], &[84], &[(84, 0)]),
            hint(4, &[94, 85, 74], &[74], &[(74, 0)]),
            hint(4, &[96, 85, 86], &[86], &[(86, 0)]),
            hint(4, &[96, 85, 76], &[76], &[(76, 0)]),
            hint(3, &[75, 74, 76, 65, 85], &[75], &[(85, 1)]),
            hint(3, &[88, 87, 89, 78, 98], &[88], &[(78, 1)]),
        ];
        engine.set_puzzles(vec![p]);
        let u = user(1);
        started(&mut engine, u, START);

        let board = [
            (1, 1),
            (5, 1),
            (13, 1),
            (20, 1),
            (26, 1),
            (6, 0),
            (8, 0),
            (12, 0),
            (14, 0),
            (17, 0),
            (33, 0),
            (42, 0),
            (44, 0),
            (53, 0),
            (98, 0),
        ];
        assert_eq!(probe(&mut engine, u, &board), 12);

        let mut board = board.to_vec();
        board.push((74, 0));
        assert_eq!(probe(&mut engine, u, &board), 14);

        board.push((76, 0));
        assert_eq!(probe(&mut engine, u, &board), 15);
    }

    /// #9588 invariant 1: a premise is served under the same rule, so a chain of negatives-only
    /// steps is walked back to its first unfilled link.
    #[test]
    fn hint_walks_a_chain_of_premises_back_to_its_first_link() {
        let mut engine = engine_with_hints(vec![
            hint(2, &[3], &[], &[(3, 0)]),
            hint(4, &[3, 5], &[], &[(5, 0)]),
            hint(3, &[5, 7, 8], &[], &[(8, 1)]),
        ]);
        let u = user(1);
        started(&mut engine, u, START);

        assert_eq!(probe(&mut engine, u, &[]), 0);
        assert_eq!(probe(&mut engine, u, &[(3, 0)]), 1);
        assert_eq!(probe(&mut engine, u, &[(3, 0), (5, 0)]), 2);
        // A premise marked out of order leaves only the link still missing
        assert_eq!(probe(&mut engine, u, &[(5, 0)]), 2);
    }

    /// #9588 invariant 1: only a negative on a key in the step's focus is a premise. An earlier
    /// negatives-only step about other cells stays skipped.
    #[test]
    fn hint_skips_negatives_only_steps_outside_the_focus() {
        let mut engine = engine_with_hints(vec![hint(2, &[1], &[], &[(1, 0)]), hint(3, &[5, 7, 8], &[], &[(8, 1)])]);
        let u = user(1);
        started(&mut engine, u, START);

        assert_eq!(probe(&mut engine, u, &[]), 1);
    }

    /// #9588 invariant 3: a step whose positives are placed is finished, and its unmarked
    /// negatives never pull it back in, even when they sit in a later step's focus.
    #[test]
    fn hint_never_pulls_back_a_step_whose_positives_are_placed() {
        let mut engine = engine_with_hints(vec![
            hint(1, &[0, 2], &[], &[(0, 1), (2, 0)]),
            hint(3, &[2, 7, 8], &[], &[(8, 1)]),
        ]);
        let u = user(1);
        started(&mut engine, u, START);

        assert_eq!(probe(&mut engine, u, &[(0, 1)]), 1);
    }

    /// #9588 invariant 1: a premise is the conclusion that is both unfilled and in the step's
    /// focus. A negatives-only step whose in-focus conclusion is marked stays skipped, however many
    /// of its other conclusions are still unmarked.
    #[test]
    fn hint_ignores_a_premise_whose_in_focus_conclusion_is_marked() {
        let mut engine = engine_with_hints(vec![
            hint(2, &[3, 9], &[], &[(3, 0), (9, 0)]),
            hint(3, &[3, 5], &[], &[(5, 1)]),
        ]);
        let u = user(1);
        started(&mut engine, u, START);

        assert_eq!(probe(&mut engine, u, &[(3, 0)]), 1);
    }

    /// #9588 invariant 4: a step already bought is never displaced by a premise, whether it is the
    /// step picked or a premise part way along the walk. Taking a mark back off the board re-serves
    /// what was paid for rather than selling the premise as a new step.
    #[test]
    fn hint_never_displaces_a_bought_step_with_its_premise() {
        let mut engine = engine_with_hints(vec![hint(2, &[3], &[], &[(3, 0)]), hint(3, &[3, 5], &[], &[(5, 1)])]);
        let u = user(1);
        started(&mut engine, u, START);

        let (step, _) = serve(&mut engine, u, 1, &[(3, 0)], 25);
        assert_eq!(step, 1);

        // The player takes the X at 3 back off: the premise is outstanding again
        match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
            HintPrepared::AlreadyServed(r) => {
                assert_eq!(r.hint.hint.focus, vec![3, 5]);
                assert_eq!(r.hints_used, 1);
            }
            _ => panic!("expected the bought step re-served"),
        }

        // A bought premise part way along the walk stops it there
        let mut engine = engine_with_hints(vec![
            hint(2, &[1], &[], &[(1, 0)]),
            hint(4, &[1, 3], &[], &[(3, 0)]),
            hint(3, &[3, 5], &[], &[(5, 1)]),
        ]);
        started(&mut engine, u, START);
        let (step, _) = serve(&mut engine, u, 1, &[(1, 0)], 25);
        assert_eq!(step, 1);
        match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
            HintPrepared::AlreadyServed(r) => assert_eq!(r.hint.hint.focus, vec![1, 3]),
            _ => panic!("expected the bought premise re-served"),
        }
    }

    /// #9588 invariant 4: a step still being paid for counts as bought. A call that overlaps its
    /// debit after a mark comes off is refused as a hint in flight, not sold the premise as a new
    /// step.
    #[test]
    fn hint_never_displaces_a_step_being_paid_for_with_its_premise() {
        let mut engine = engine_with_hints(vec![hint(2, &[3], &[], &[(3, 0)]), hint(3, &[3, 5], &[], &[(5, 1)])]);
        let u = user(1);
        started(&mut engine, u, START);

        match engine.reserve_hint(u, GAME, NUMBER, 1, &[(3, 0)], 25, START).unwrap() {
            HintPrepared::Serve { step, .. } => assert_eq!(step, 1),
            _ => panic!("expected a serve"),
        }
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START),
            OCErrorCode::Throttled,
        );
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 1);
    }

    #[test]
    fn hint_new_step_after_cap_errors_but_a_step_already_served_is_re_served() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        // max_hints is 2
        serve(&mut engine, u, 1, &[], 25);
        serve(&mut engine, u, 1, &[(0, 1), (2, 0)], 25);
        assert_err(
            engine.reserve_hint(u, GAME, NUMBER, 1, &[(0, 1), (2, 0), (6, 1)], 25, START),
            OCErrorCode::Throttled,
        );
        // Taking the marks back off asks for step 0 again, which the user already has
        match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
            HintPrepared::AlreadyServed(r) => assert_eq!(r.hints_used, 2),
            _ => panic!("expected a re-serve"),
        }
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

    /// #9675 H1: one purchase is the step's outline and sentence, whatever level an old client asks
    /// for, and never its answer. A target naming a key the step concludes is withheld.
    #[test]
    fn a_hint_is_the_outline_and_sentence_never_the_answer() {
        let mut engine = DailyPuzzleEngine::default();
        let mut p = puzzle(NUMBER, true);
        // Step 0's target points at its own conclusion; step 1's points elsewhere
        p.hints[0].target = vec![0];
        p.hints[1].target = vec![1];
        engine.set_puzzles(vec![p]);
        let u = user(1);
        started(&mut engine, u, START);

        let (_, r) = serve(&mut engine, u, 3, &[], 25);
        assert_eq!(r.hint.level, HINT_LEVEL);
        assert_eq!(r.hint.hint.technique, 1);
        assert!(r.hint.hint.target.is_empty());
        assert!(r.hint.hint.conclusions.is_empty());
        assert_eq!(r.hint.hint.focus, vec![4]);

        let (_, r) = serve(&mut engine, u, 1, &[(0, 1), (2, 0)], 25);
        assert_eq!(r.hint.hint.technique, 2);
        assert_eq!(r.hint.hint.target, vec![1]);
        assert!(r.hint.hint.conclusions.is_empty());
        for served in state(&engine, u, START).hints {
            assert!(served.hint.conclusions.is_empty());
            assert_eq!(served.level, HINT_LEVEL);
        }
    }

    /// #9675 H2: a step the user already has is re-served free, whatever level is asked for, and
    /// takes no new place against the cap.
    #[test]
    fn asking_again_for_a_step_is_free_whatever_the_level() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        let (step, first) = serve(&mut engine, u, 1, &[], 25);
        for level in 1..=3 {
            match engine.reserve_hint(u, GAME, NUMBER, level, &[], 25, START).unwrap() {
                HintPrepared::AlreadyServed(r) => assert_eq!(r.hint, first.hint),
                _ => panic!("expected step {step} re-served at level {level}"),
            }
        }
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 1);
    }

    /// #9675 H3: every new step costs the one price, whatever level an old client asks for, and the
    /// price quoted back on a mismatch is that price.
    #[test]
    fn every_new_step_costs_the_one_price_whatever_the_level() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);
        let price = engine.puzzle(GAME).unwrap().game_config.hint_prices[0];

        for level in [2, 3] {
            let Err(error) = engine.reserve_hint(u, GAME, NUMBER, level, &[], price + 50, START) else {
                panic!("a price other than the one price should be refused");
            };
            assert!(error.matches_code(OCErrorCode::PriceMismatch), "{error:?}");
        }
        let (_, r) = serve(&mut engine, u, 3, &[], price);
        assert!(!r.hint.mistake);
        let (_, _) = serve(&mut engine, u, 2, &[(0, 1), (2, 0)], price);
        assert_eq!(engine.record(u, GAME, NUMBER).unwrap().hint_steps_used, 2);
    }

    /// #9675 H5: in Bridges a conclusion is a gap between islands while focus and target are
    /// cells. Target withholding and the premise walk compare the cells the board draws a
    /// conclusion on (`DailyPuzzle::hint_settles`), not the gap key itself.
    #[test]
    fn bridges_conclusions_are_compared_as_the_cells_they_are_drawn_on() {
        let mut p = puzzle(NUMBER, true);
        // Gap keys 100 and 101 are drawn on cells 1 and 3. Step 0 rules gap 100 out; step 1 rests
        // on it (its focus holds cell 1) and puts a bridge on gap 101, drawn on cell 3, which is
        // also its target.
        p.hints = vec![hint(2, &[0, 1], &[0], &[(100, 0)]), hint(1, &[1, 3, 4], &[3, 4], &[(101, 1)])];
        p.hint_settles = vec![vec![(100, 1)], vec![(101, 3)]];
        p.solution_pairs = vec![(100, 0), (101, 1)];
        let mut engine = DailyPuzzleEngine::default();
        engine.set_puzzles(vec![p.clone()]);
        let u = user(1);
        started(&mut engine, u, START);

        // The premise is outstanding, so it is served first, though its gap key is in no focus
        assert_eq!(probe(&mut engine, u, &[]), 0);
        // Step 1's target names cell 3, where its conclusion is drawn, so it is withheld
        assert!(served_hint(&p, 1).target.is_empty());
        // Without the mapping (a puzzle pushed before it existed) the gap keys are compared as they
        // are, as before
        p.hint_settles = Vec::new();
        assert_eq!(served_hint(&p, 1).target, vec![3, 4]);
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

    // A wrong placement is usually the cause and a wrong "no" its consequence: CHAT Rooms sends the
    // cells a placed CHAT rules out as "no" marks, so a wrong CHAT puts a false "no" on the true
    // CHAT beside it, often at a lower key. The check names the placement, which is what the
    // player can act on, and names a "no" mark only when no placement is wrong (CHAT Rooms
    // invariant 21).
    #[test]
    fn hint_mistake_names_a_wrong_placement_before_a_wrong_no_mark() {
        let mut engine = new_engine();
        let u = user(1);
        started(&mut engine, u, START);

        // Solution is [1, 0, 0, 0, 0, 0, 1, 0, 1]: the "no" at 0 and the placement at 1 are both
        // wrong, and 0 is the lower key
        match engine
            .reserve_hint(u, GAME, NUMBER, 1, &[(0, 0), (1, 1), (2, 0)], 0, START)
            .unwrap()
        {
            HintPrepared::Mistake(r) => assert_eq!(r.hint.hint.focus, vec![1]),
            _ => panic!("expected a mistake hint"),
        }

        // With no placement wrong, the lowest wrong "no" mark is named
        match engine
            .reserve_hint(u, GAME, NUMBER, 1, &[(8, 0), (6, 0), (2, 0)], 0, START)
            .unwrap()
        {
            HintPrepared::Mistake(r) => assert_eq!(r.hint.hint.focus, vec![6]),
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

        let step = match engine.reserve_hint(u, GAME, NUMBER, 1, &[], 25, START).unwrap() {
            HintPrepared::Serve { step, result, .. } => {
                // The caller buying the hint sees it in its own response
                assert_eq!(result.state.hints.len(), 1);
                assert_eq!(result.state.hints[0].level, HINT_LEVEL);
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
        engine.release_hint(u, GAME, NUMBER, step);
        assert_eq!(state(&engine, u, START).hints.len(), 1);
        let (step, _) = serve(&mut engine, u, 1, &[(0, 1), (2, 0), (6, 1)], 25);
        assert_eq!(step, 2);
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

    // Regenerating a day drops the records made against the old puzzle, so every call is made
    // again. The keys must not move with the puzzle, or the replay would charge a second entry
    // fee and pay a second reward to someone who had already solved that day.
    #[test]
    fn regenerated_puzzle_keeps_the_same_chit_keys() {
        let mut engine = new_engine();
        let before = (
            engine.entry_key(NUMBER),
            engine.solve_key(NUMBER),
            engine.hint_key(GAME, NUMBER, 1, 2),
        );

        let mut regenerated = puzzle(NUMBER, true);
        regenerated.description[3] = 1;
        engine.set_puzzles(vec![regenerated]);

        assert_eq!(engine.entry_key(NUMBER), before.0);
        assert_eq!(engine.solve_key(NUMBER), before.1);
        assert_eq!(engine.hint_key(GAME, NUMBER, 1, 2), before.2);
        assert!(engine.hint_key(GAME, NUMBER, u16::MAX, 3).len() <= 64);
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
