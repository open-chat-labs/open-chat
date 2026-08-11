use ic_cdk::call::{Error, RejectCode};
use std::cmp::Ordering;
use types::{BuildVersion, C2CError, C2CRetryPolicy, CanisterId, Milliseconds, UpgradesFilter};

mod canisters_requiring_upgrade;
mod chunk_store;
mod create;
mod delete;
mod deposit_cycles;
mod filtered_upgrades;
mod install;
mod pool;
mod raw_rand;
mod start;
mod status;
mod stop;
mod uninstall;
mod update_settings;

pub use canisters_requiring_upgrade::*;
pub use chunk_store::*;
use constants::MINUTE_IN_MS;
pub use create::*;
pub use delete::*;
pub use deposit_cycles::*;
pub use filtered_upgrades::*;
pub use install::*;
pub use pool::*;
pub use raw_rand::*;
pub use start::*;
pub use status::*;
pub use stop::*;
pub use uninstall::*;
pub use update_settings::*;

pub fn is_out_of_cycles_error(reject_code: RejectCode, message: &str) -> bool {
    matches!(reject_code, RejectCode::SysTransient) && message.contains("out of cycles")
}

// The reject message for this case doesn't always include the `IC0512` code, so also match on
// the message text
pub fn is_invalid_controller_error(reject_code: RejectCode, message: &str) -> bool {
    matches!(reject_code, RejectCode::CanisterError) && (message.contains("IC0512") || message.contains("can control it"))
}

// Returns `Some(delay)` if the call should be retried, else `None`.
pub fn delay_if_should_retry_failed_c2c_call(error: &C2CError) -> Option<Milliseconds> {
    match error.retry_policy() {
        C2CRetryPolicy::DoNotRetry => None,
        C2CRetryPolicy::RetryImmediately => Some(0),
        C2CRetryPolicy::RetryAfterDelay => Some(5 * MINUTE_IN_MS),
    }
}

pub fn is_target_canister_uninstalled_or_deleted(reject_code: RejectCode, message: &str) -> bool {
    match reject_code {
        RejectCode::DestinationInvalid => true,
        RejectCode::CanisterError if message.contains("IC0537") => true,
        _ => false,
    }
}

pub fn should_perform_upgrade(
    canister_id: CanisterId,
    current: BuildVersion,
    next: BuildVersion,
    filter: &UpgradesFilter,
    test_mode: bool,
) -> bool {
    match current.cmp(&next) {
        Ordering::Less => {}
        Ordering::Greater if test_mode => {}
        _ => return false,
    };

    if filter.exclude.contains(&canister_id) {
        false
    } else if filter.versions.is_empty() && filter.include.is_empty() {
        true
    } else {
        filter.versions.contains(&current) || filter.include.contains(&canister_id)
    }
}

pub fn convert_cdk_error(canister_id: CanisterId, method_name: &'static str, error: Error) -> C2CError {
    C2CError::from_cdk_error(canister_id, method_name, error)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Which policy a given failure maps to is covered by the tests alongside
    // `C2CRetryPolicy::from_cdk_error` in the `types` crate
    #[test]
    fn delay_matches_retry_policy() {
        let error = |policy| {
            C2CError::new_with_retry_policy(CanisterId::anonymous(), "method", RejectCode::SysFatal, String::new(), policy)
        };

        assert_eq!(
            delay_if_should_retry_failed_c2c_call(&error(C2CRetryPolicy::DoNotRetry)),
            None
        );
        assert_eq!(
            delay_if_should_retry_failed_c2c_call(&error(C2CRetryPolicy::RetryImmediately)),
            Some(0)
        );
        assert_eq!(
            delay_if_should_retry_failed_c2c_call(&error(C2CRetryPolicy::RetryAfterDelay)),
            Some(5 * MINUTE_IN_MS)
        );
    }
}
