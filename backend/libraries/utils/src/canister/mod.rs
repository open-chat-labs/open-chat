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
use constants::{MINUTE_IN_MS, SECOND_IN_MS};
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
        C2CRetryPolicy::RetryAfterShortDelay => Some(10 * SECOND_IN_MS),
        C2CRetryPolicy::RetryAfterDelay => Some(5 * MINUTE_IN_MS),
    }
}

// For a call to a method which not every live version of the callee has yet. A missing method is
// otherwise not retried, but here it will appear once the callee is upgraded, so keep retrying until
// it has been.
pub fn delay_if_should_retry_failed_c2c_call_to_new_method(error: &C2CError) -> Option<Milliseconds> {
    if error.is_method_not_found() {
        Some(5 * MINUTE_IN_MS)
    } else {
        delay_if_should_retry_failed_c2c_call(error)
    }
}

// A canister which has been uninstalled still exists, so the call is not rejected with
// `DestinationInvalid` - it fails with `CanisterError`, which we otherwise cannot tell apart from
// the callee trapping. The `IC0537` code identifies it, but the IC does not expose the fine grained
// error codes to canisters, so it is only ever in the reject message at the replica's discretion.
// The reject text itself is "...contains no Wasm module.", so match on that too.
pub fn is_target_canister_uninstalled_or_deleted(reject_code: RejectCode, message: &str) -> bool {
    match reject_code {
        RejectCode::DestinationInvalid => true,
        RejectCode::CanisterError => message.contains("IC0537") || message.contains("no Wasm module"),
        _ => false,
    }
}

// Whether a call to a User canister failed in a way it does once its user has been migrated to a
// MultiUser canister: the canister is uninstalled, then briefly installed with the cycles refunder,
// which has none of the User canister's methods, and then uninstalled again. A caller finding this
// checks whether the user has been migrated, so that it can send the call on to them.
pub fn is_user_canister_possibly_migrated(error: &C2CError) -> bool {
    is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) || error.is_method_not_found()
}

// Rejects an update call made while the canister is frozen. It traps rather than returning an
// error, since a trap is a `CanisterError`, which the queues sending events to the canister retry,
// whereas a reject from a guard is a `CanisterReject`, which they drop.
pub fn trap_if_frozen(is_frozen: bool) {
    if is_frozen {
        ic_cdk::trap("Canister is frozen");
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

    // The reject text as the replica actually sends it, captured in
    // `frontend/openchat-agent/src/services/error.spec.ts`. The `IC0537` code sits in a separate
    // field which only the frontend sees, so a canister has nothing but this text to go on.
    const NO_WASM_MODULE_REJECT_MESSAGE: &str = "...contains no Wasm module.";

    #[test]
    fn uninstalled_target_is_detected_without_the_ic_error_code() {
        assert!(is_target_canister_uninstalled_or_deleted(
            RejectCode::CanisterError,
            NO_WASM_MODULE_REJECT_MESSAGE
        ));
        // Still detected if a replica does include the code
        assert!(is_target_canister_uninstalled_or_deleted(
            RejectCode::CanisterError,
            "IC0537: whatever"
        ));
    }

    #[test]
    fn deleted_target_is_detected_from_the_reject_code_alone() {
        assert!(is_target_canister_uninstalled_or_deleted(RejectCode::DestinationInvalid, ""));
    }

    #[test]
    fn a_trapping_target_is_not_mistaken_for_an_uninstalled_one() {
        assert!(!is_target_canister_uninstalled_or_deleted(
            RejectCode::CanisterError,
            "trapped explicitly: something went wrong"
        ));
        assert!(!is_target_canister_uninstalled_or_deleted(
            RejectCode::SysTransient,
            "Canister x is out of cycles"
        ));
    }

    #[test]
    fn a_user_canister_may_have_been_migrated_if_uninstalled_deleted_or_missing_the_method() {
        let error =
            |reject_code, message: &str| C2CError::new(CanisterId::anonymous(), "method", reject_code, message.to_string());

        assert!(is_user_canister_possibly_migrated(&error(
            RejectCode::CanisterError,
            NO_WASM_MODULE_REJECT_MESSAGE
        )));
        assert!(is_user_canister_possibly_migrated(&error(RejectCode::DestinationInvalid, "")));
        // As when the cycles refunder is installed in place of the User canister
        assert!(is_user_canister_possibly_migrated(&error(
            RejectCode::CanisterError,
            "Canister has no update method 'method_msgpack'"
        )));
        assert!(!is_user_canister_possibly_migrated(&error(
            RejectCode::CanisterError,
            "trapped explicitly: something went wrong"
        )));
        assert!(!is_user_canister_possibly_migrated(&error(RejectCode::CanisterReject, "")));
    }

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
            delay_if_should_retry_failed_c2c_call(&error(C2CRetryPolicy::RetryAfterShortDelay)),
            Some(10 * SECOND_IN_MS)
        );
        assert_eq!(
            delay_if_should_retry_failed_c2c_call(&error(C2CRetryPolicy::RetryAfterDelay)),
            Some(5 * MINUTE_IN_MS)
        );
    }

    #[test]
    fn a_missing_new_method_is_retried_until_the_callee_has_it() {
        let method_not_found = C2CError::new_with_retry_policy(
            CanisterId::anonymous(),
            "method",
            RejectCode::CanisterError,
            "Canister has no update method 'method_msgpack'".to_string(),
            C2CRetryPolicy::DoNotRetry,
        );
        assert_eq!(delay_if_should_retry_failed_c2c_call(&method_not_found), None);
        assert_eq!(
            delay_if_should_retry_failed_c2c_call_to_new_method(&method_not_found),
            Some(5 * MINUTE_IN_MS)
        );

        // Any other failure is treated as usual
        let rejected = C2CError::new(CanisterId::anonymous(), "method", RejectCode::CanisterReject, String::new());
        assert_eq!(delay_if_should_retry_failed_c2c_call_to_new_method(&rejected), None);
    }
}
