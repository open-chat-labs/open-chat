use crate::guards::caller_is_governance_principal;
use crate::jobs::generate_candidates;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::regenerate_today::*;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

/// Ops tool for a broken or forced puzzle. Drops today's shipped puzzle(s) and candidate pool and
/// generates today's puzzle again through the normal per-candidate timer path, so it appears
/// within a few ticks and is then pushed to every local user index. With `game_id` set, today's
/// puzzle is that game instead of the scheduled one, using the first schedule entry for that game
/// or the default params when it isn't scheduled at all; the schedule itself is untouched and
/// tomorrow follows it as usual. Each call salts the seed so the replacement differs from the
/// puzzle it replaces.
///
/// Results already recorded here for today's old puzzle stay (keyed by number + game; harmless).
/// Local user indexes only drop their user records when the pushed number changes, and today's
/// number doesn't, so: when the game changes, users who started the old game keep a record for a
/// game that is no longer in the set, which `daily_puzzle_fetch` simply doesn't list; when the
/// game is the same, those records carry over to the new puzzle, so a user who had started or
/// solved the old one is treated as having started or solved the new one.
#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn regenerate_today(args: Args) -> Response {
    mutate_state(|state| {
        let now = state.env.now();
        if let Err(message) = state.data.regenerate_today(args.game_id, now) {
            return UnitResult::Error(OCErrorCode::InvalidRequest.with_message(message));
        }
        generate_candidates::start_job_if_required(state);
        UnitResult::Success
    })
}
