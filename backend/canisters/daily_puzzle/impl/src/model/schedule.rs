use constants::MAX_GAME_CHIT_ABS_AMOUNT;
use daily_puzzle_canister::PuzzleParams;
use types::{DailyPuzzleConfig, GameConfig, PuzzleNumber};

pub const PUZZLES_TO_KEEP: usize = 14;
pub const RESULTS_RETENTION_DAYS: u32 = 30;

const EASY: u8 = 0;
const TRICKY: u8 = 1;

/// Game ids this canister can generate. The schedule may only name these.
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

/// Mon..Sun
pub fn default_schedule() -> Vec<PuzzleParams> {
    vec![
        params(light_up::GAME_ID, 7, 7, EASY),
        params(tents::GAME_ID, 8, 8, EASY),
        params(slant::GAME_ID, 6, 6, EASY),
        params(bridges::GAME_ID, 7, 7, EASY),
        params(unruly::GAME_ID, 8, 8, EASY),
        params(tents::GAME_ID, 10, 10, TRICKY),
        params(light_up::GAME_ID, 10, 10, TRICKY),
    ]
}

/// Sensible easy params for any generator we have, whether or not it is on a schedule. Every
/// entry in `generators()` needs one, so that `regenerate_today` can force a game that no
/// schedule currently names: a retired game stays forceable for testing, and putting it back is
/// a config change rather than a canister release.
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

/// Params for a game forced outside the schedule: its first entry in `schedule`, else the default
/// schedule's easy entry for it, else the game's own default. None for a game this canister
/// can't generate.
pub fn forced_params(schedule: &[PuzzleParams], game_id: &str) -> Option<PuzzleParams> {
    schedule
        .iter()
        .chain(default_schedule().iter())
        .find(|p| p.game_id == game_id)
        .cloned()
        .or_else(|| default_params(game_id))
}

/// Every game at least once a week, all easy and small, so test environments generate
/// synchronously and cheaply while still exercising each generator.
pub fn test_schedule() -> Vec<PuzzleParams> {
    vec![
        params(light_up::GAME_ID, 7, 7, EASY),
        params(tents::GAME_ID, 8, 8, EASY),
        params(slant::GAME_ID, 6, 6, EASY),
        params(bridges::GAME_ID, 7, 7, EASY),
        params(unruly::GAME_ID, 6, 6, EASY),
        params(slant::GAME_ID, 6, 6, EASY),
        params(bridges::GAME_ID, 7, 7, EASY),
    ]
}

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
        // An upgrade is priced at the difference between the two levels, so a flat or descending
        // entry costs nothing: buy level 1, then take the conclusions - the answer - for free.
        if i > 0 && *price <= config.hint_prices[i - 1] {
            return Err(format!("hint_prices[{i}] must be greater than hint_prices[{}]", i - 1));
        }
    }
    Ok(())
}
