//! The weekday rota and the per-game parameters. Every value here changes by release: the only
//! series value an operator sets at run time is `enabled` (#9357). Prices, rewards and caps are
//! the `Default` impls of `DailyPuzzleConfig` and `GameConfig` in the types crate, the one place
//! each is defined; `Data::config` composes the enabled flag onto them.

use daily_puzzle_canister::PuzzleParams;
use types::PuzzleNumber;

pub const PUZZLES_TO_KEEP: usize = 14;
pub const RESULTS_RETENTION_DAYS: u32 = 30;

const EASY: u8 = 0;
const TRICKY: u8 = 1;

/// Game ids this canister can generate. The rota may only name these.
#[cfg(test)]
pub fn generators() -> &'static [&'static str] {
    &[
        light_up::GAME_ID,
        tents::GAME_ID,
        slant::GAME_ID,
        bridges::GAME_ID,
        loopy::GAME_ID,
        unruly::GAME_ID,
    ]
}

/// Weekday of puzzle number N, 0 = Monday. Number 0 (1970-01-01) was a Thursday.
pub fn weekday(number: PuzzleNumber) -> usize {
    ((number + 3) % 7) as usize
}

/// `black_pct` only means anything to light_up; the other generators ignore it.
fn params(game_id: &str, width: u8, height: u8, tier: u8) -> PuzzleParams {
    PuzzleParams {
        game_id: game_id.to_string(),
        width,
        height,
        tier,
        black_pct: 20,
    }
}

/// The rota, Mon..Sun. Loopy is benched: far harder than the rest, still generated on demand.
pub fn schedule() -> [PuzzleParams; 7] {
    [
        params(light_up::GAME_ID, 7, 7, EASY),
        params(tents::GAME_ID, 8, 8, EASY),
        params(slant::GAME_ID, 6, 6, EASY),
        params(bridges::GAME_ID, 7, 7, EASY),
        params(unruly::GAME_ID, 8, 8, EASY),
        params(tents::GAME_ID, 10, 10, TRICKY),
        params(light_up::GAME_ID, 10, 10, TRICKY),
    ]
}

/// The rota's entry for `number`'s weekday.
pub fn scheduled(number: PuzzleNumber) -> PuzzleParams {
    schedule().into_iter().nth(weekday(number)).unwrap()
}

/// Sensible easy params for any generator we have, whether or not the rota names it. Every entry
/// in `generators()` needs one, so that `regenerate_today` can force a game the rota doesn't
/// name: a benched game stays forceable for testing.
fn default_params(game_id: &str) -> Option<PuzzleParams> {
    match game_id {
        light_up::GAME_ID => Some(params(light_up::GAME_ID, 7, 7, EASY)),
        tents::GAME_ID => Some(params(tents::GAME_ID, 8, 8, EASY)),
        slant::GAME_ID => Some(params(slant::GAME_ID, 6, 6, EASY)),
        bridges::GAME_ID => Some(params(bridges::GAME_ID, 7, 7, EASY)),
        loopy::GAME_ID => Some(params(loopy::GAME_ID, 6, 6, EASY)),
        unruly::GAME_ID => Some(params(unruly::GAME_ID, 8, 8, EASY)),
        _ => None,
    }
}

/// Params for a game forced outside the rota: its first rota entry, else the game's own default.
/// None for a game this canister can't generate.
pub fn forced_params(game_id: &str) -> Option<PuzzleParams> {
    schedule()
        .into_iter()
        .find(|p| p.game_id == game_id)
        .or_else(|| default_params(game_id))
}

/// Nothing sets these at run time any more, so the checks that used to guard the setters now run
/// over the constants as tests: a release that breaks one fails CI rather than shipping (#9357).
#[cfg(test)]
pub mod launch_checks {
    use super::*;
    use constants::MAX_GAME_CHIT_ABS_AMOUNT;
    use types::{DailyPuzzleConfig, GameConfig};

    pub fn validate_schedule(schedule: &[PuzzleParams]) -> Result<(), String> {
        if schedule.len() != 7 {
            return Err(format!("schedule must have 7 entries, got {}", schedule.len()));
        }
        for (i, p) in schedule.iter().enumerate() {
            if !generators().contains(&p.game_id.as_str()) {
                return Err(format!("entry {i}: unknown game_id '{}'", p.game_id));
            }
            if !(5..=14).contains(&p.width) || !(5..=14).contains(&p.height) {
                return Err(format!("entry {i}: width and height must be within 5..=14"));
            }
            if p.tier > 1 {
                return Err(format!("entry {i}: tier must be 0 or 1"));
            }
            // Unruly splits every row and column evenly between its two values, so an odd side
            // has no solution at all and the generator would spin.
            if p.game_id == unruly::GAME_ID && (p.width % 2 != 0 || p.height % 2 != 0) {
                return Err(format!("entry {i}: unruly needs an even width and height"));
            }
            if p.game_id == light_up::GAME_ID && !(10..=60).contains(&p.black_pct) {
                return Err(format!("entry {i}: black_pct must be within 10..=60"));
            }
        }
        Ok(())
    }

    // Every CHIT figure is checked against the user canister's own limit here. Above it the user
    // canister answers `InvalidRequest`: an entry fee that large makes every start fail while the
    // game still reports itself enabled, and a reward that large is refused after the solve is
    // already recorded, so the player is credited nothing and told nothing.
    fn validate_chit_amount(label: &str, amount: u32) -> Result<(), String> {
        if i32::try_from(amount).is_ok_and(|a| a <= MAX_GAME_CHIT_ABS_AMOUNT) {
            Ok(())
        } else {
            Err(format!("{label} must not exceed {MAX_GAME_CHIT_ABS_AMOUNT}"))
        }
    }

    pub fn validate_config(config: &DailyPuzzleConfig) -> Result<(), String> {
        if config.reward_by_streak.is_empty() {
            return Err("reward_by_streak must not be empty".to_string());
        }
        if config.max_submits == 0 {
            return Err("max_submits must be at least 1".to_string());
        }
        // The free mistake check reads the solution a key at a time, so the bound has to stay well
        // under the key count of the smallest board we ship (36) to be worth anything
        if !(1..=30).contains(&config.max_free_checks) {
            return Err("max_free_checks must be within 1..=30".to_string());
        }
        validate_chit_amount("entry_fee", config.entry_fee)?;
        validate_chit_amount("hint_penalty", config.hint_penalty)?;
        for (i, reward) in config.reward_by_streak.iter().enumerate() {
            validate_chit_amount(&format!("reward_by_streak[{i}]"), *reward)?;
        }
        Ok(())
    }

    pub fn validate_game_config(config: &GameConfig) -> Result<(), String> {
        if !(1..=3).contains(&config.hint_prices.len()) {
            return Err("hint_prices must have 1 to 3 entries (one per level)".to_string());
        }
        if !(1..=10).contains(&config.max_hints) {
            return Err("max_hints must be within 1..=10".to_string());
        }
        for (i, price) in config.hint_prices.iter().enumerate() {
            validate_chit_amount(&format!("hint_prices[{i}]"), *price)?;
            // Every level costs. A free level 1 is served with no debit and no idempotency key, and
            // hands back the free check its call spent, so it is unmetered in both currencies.
            if i == 0 && *price == 0 {
                return Err("hint_prices[0] must be greater than 0".to_string());
            }
            // An upgrade is priced at the difference between the two levels, so a flat or descending
            // entry costs nothing: buy level 1, then take the conclusions - the answer - for free.
            if i > 0 && *price <= config.hint_prices[i - 1] {
                return Err(format!("hint_prices[{i}] must be greater than hint_prices[{}]", i - 1));
            }
        }
        Ok(())
    }
}
