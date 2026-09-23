use crate::User;
use constants::MAX_GAME_CHIT_ABS_AMOUNT;
use oc_error_codes::OCErrorCode;
use types::{ChitEvent, ChitEventType, OCResult, TimestampMillis};
use user_canister::c2c_game_chit::{Args, SuccessResult};

const MAX_ID_LENGTH: usize = 64;

// Credits (or debits) the CHIT the user won or spent in a game, at most once per key. The caller
// notifies the UserIndex of the new balance.
pub fn c2c_game_chit(user: &mut User, args: Args, now: TimestampMillis) -> OCResult<SuccessResult> {
    user.verify_not_suspended()?;
    validate_game_chit_args(&args).map_err(|message| OCErrorCode::InvalidRequest.with_message(message))?;

    // Checked before the balance so that a repeated key always returns AlreadyAdded, even if the
    // balance has since dropped
    if user.game_chit_keys.contains(&args.game_id, &args.key) {
        return Err(OCErrorCode::AlreadyAdded.into());
    }

    let chit_balance = user.chit_events.chit_balance();
    if args.amount < 0 && chit_balance < -args.amount {
        // The key is deliberately not recorded here, so the debit can be retried once affordable
        return Err(OCErrorCode::InsufficientFunds.with_message(chit_balance));
    }

    user.game_chit_keys.insert(&args.game_id, &args.key, now);
    user.chit_events.push(ChitEvent {
        timestamp: now,
        amount: args.amount,
        reason: ChitEventType::Game {
            game_id: args.game_id,
            key: args.key,
        },
    });

    Ok(SuccessResult {
        chit_balance: user.chit_events.chit_balance(),
        total_chit_earned: user.chit_events.total_chit_earned(),
    })
}

// Checks the amount and ids of a request to add CHIT won or spent in a game
fn validate_game_chit_args(args: &Args) -> Result<(), &'static str> {
    // Not `abs()`, which wraps for `i32::MIN` and would let that one value through
    if args.amount == 0 || args.amount < -MAX_GAME_CHIT_ABS_AMOUNT || args.amount > MAX_GAME_CHIT_ABS_AMOUNT {
        return Err("Invalid amount");
    }
    if args.game_id.is_empty() || args.game_id.len() > MAX_ID_LENGTH || args.key.is_empty() || args.key.len() > MAX_ID_LENGTH {
        return Err("Invalid game_id or key");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    fn user() -> User {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
        User::new(Principal::from_slice(&[9]), "username".to_string(), None, 100)
    }

    #[test]
    fn repeated_key_is_rejected_even_once_the_balance_has_dropped() {
        let mut user = user();
        assert_eq!(
            c2c_game_chit(&mut user, args("light_up", "1:solve", 100), 1000)
                .unwrap()
                .chit_balance,
            100
        );
        assert_eq!(
            c2c_game_chit(&mut user, args("light_up", "1:hint", -100), 1001)
                .unwrap()
                .chit_balance,
            0
        );
        assert!(
            c2c_game_chit(&mut user, args("light_up", "1:solve", 100), 1002)
                .unwrap_err()
                .matches_code(OCErrorCode::AlreadyAdded)
        );
    }

    #[test]
    fn unaffordable_debit_is_not_recorded_so_it_can_be_retried() {
        let mut user = user();
        assert!(
            c2c_game_chit(&mut user, args("light_up", "1:hint", -50), 1000)
                .unwrap_err()
                .matches_code(OCErrorCode::InsufficientFunds)
        );
        assert_eq!(
            c2c_game_chit(&mut user, args("light_up", "1:solve", 100), 1001)
                .unwrap()
                .chit_balance,
            100
        );
        assert_eq!(
            c2c_game_chit(&mut user, args("light_up", "1:hint", -50), 1002)
                .unwrap()
                .chit_balance,
            50
        );
    }

    fn args(game_id: &str, key: &str, amount: i32) -> Args {
        Args {
            user_id: candid::Principal::anonymous().into(),
            game_id: game_id.to_string(),
            key: key.to_string(),
            amount,
        }
    }

    // #9332 invariant 14. The amount is bounded by range, not `abs()`, so `i32::MIN` is refused
    // like any other value outside the limit rather than wrapping past both the limit and the
    // balance check.
    #[test]
    fn amount_and_ids_are_bounded() {
        for amount in [1, -1, MAX_GAME_CHIT_ABS_AMOUNT, -MAX_GAME_CHIT_ABS_AMOUNT] {
            assert!(
                validate_game_chit_args(&args("light_up", "1:solve", amount)).is_ok(),
                "{amount}"
            );
        }
        for amount in [
            0,
            MAX_GAME_CHIT_ABS_AMOUNT + 1,
            -MAX_GAME_CHIT_ABS_AMOUNT - 1,
            i32::MAX,
            i32::MIN,
        ] {
            assert_eq!(
                validate_game_chit_args(&args("light_up", "1:solve", amount)),
                Err("Invalid amount"),
                "{amount}"
            );
        }
        let long = "g".repeat(MAX_ID_LENGTH + 1);
        let max = "g".repeat(MAX_ID_LENGTH);
        assert!(validate_game_chit_args(&args(&max, &max, 10)).is_ok());
        for (game_id, key) in [
            ("", "1:solve"),
            ("light_up", ""),
            (long.as_str(), "1:solve"),
            ("light_up", long.as_str()),
        ] {
            assert_eq!(
                validate_game_chit_args(&args(game_id, key, 10)),
                Err("Invalid game_id or key"),
                "{game_id:?} {key:?}"
            );
        }
    }
}
