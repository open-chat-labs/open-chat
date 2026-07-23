use ic_cdk::call::{CallErrorExt, Error, RejectCode};
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
pub use stop::*;
pub use uninstall::*;
pub use update_settings::*;

pub fn is_out_of_cycles_error(reject_code: RejectCode, message: &str) -> bool {
    matches!(reject_code, RejectCode::SysTransient) && message.contains("out of cycles")
}

// Returns `Some(delay)` if the call should be retried, else `None`.
pub fn delay_if_should_retry_failed_c2c_call(error: &C2CError) -> Option<Milliseconds> {
    match error.retry_policy() {
        C2CRetryPolicy::DoNotRetry => None,
        C2CRetryPolicy::RetryImmediately => Some(0),
        C2CRetryPolicy::RetryAfterDelay => Some(5 * MINUTE_IN_MS),
    }
}

// Determines whether a failed c2c call is worth retrying.
//
// This must be done while we still have the CDK's `Error`, since that is the only place the CDK
// exposes its own view of the failure. Note we deliberately do not look at the reject message -
// the IC does not expose the fine grained error codes (eg. IC0207) to canisters, only the coarse
// `RejectCode`, so any code found in the message is there at the replica's discretion and cannot
// be relied upon.
fn retry_policy(error: &Error) -> C2CRetryPolicy {
    // Failures which will recur however many times we retry
    let permanent = match error {
        // The caller and callee disagree on the response type, which retrying cannot fix
        Error::CandidDecodeFailed(_) => true,
        Error::CallRejected(rejected) => matches!(
            rejected.reject_code(),
            // The callee does not exist, or explicitly rejected the call
            Ok(RejectCode::DestinationInvalid | RejectCode::CanisterReject)
        ),
        _ => false,
    };

    if permanent {
        C2CRetryPolicy::DoNotRetry
    } else if error.is_immediately_retryable() && !maybe_callee_out_of_cycles(error) {
        C2CRetryPolicy::RetryImmediately
    } else {
        C2CRetryPolicy::RetryAfterDelay
    }
}

// `CallErrorExt::is_immediately_retryable` treats every `SysTransient` failure as safe to retry
// straight away, but a callee which is out of cycles surfaces as `SysTransient` too (`IC0207` maps
// to `SysTransient`) and retrying that in a tight loop only burns our own cycles until someone
// tops the callee up. We can no longer tell the two apart, so we treat all of them as needing a
// delay. If the IC ever exposes error codes to canisters this can be narrowed back down.
fn maybe_callee_out_of_cycles(error: &Error) -> bool {
    matches!(error, Error::CallRejected(rejected) if matches!(rejected.reject_code(), Ok(RejectCode::SysTransient)))
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
    let retry_policy = retry_policy(&error);

    let (code, msg) = match error {
        Error::InsufficientLiquidCycleBalance(cb) => (RejectCode::SysTransient, cb.to_string()),
        Error::CallPerformFailed(f) => (RejectCode::SysTransient, f.to_string()),
        Error::CallRejected(r) => (r.reject_code().unwrap_or(RejectCode::SysUnknown), r.to_string()),
        Error::CandidDecodeFailed(f) => (RejectCode::CanisterReject, f.to_string()),
    };

    C2CError::new_with_retry_policy(canister_id, method_name, code, msg, retry_policy)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_cdk::call::CallRejected;

    fn rejected(reject_code: RejectCode) -> Error {
        // The reject message deliberately contains no IC error code, since we can no longer rely
        // on one being present
        Error::CallRejected(CallRejected::with_rejection(reject_code as u32, "rejected".to_string()))
    }

    #[test]
    fn failures_which_will_always_recur_are_not_retried() {
        assert_eq!(
            retry_policy(&rejected(RejectCode::DestinationInvalid)),
            C2CRetryPolicy::DoNotRetry
        );
        assert_eq!(
            retry_policy(&rejected(RejectCode::CanisterReject)),
            C2CRetryPolicy::DoNotRetry
        );
    }

    #[test]
    fn failures_which_may_resolve_later_are_retried_after_a_delay() {
        // A callee which is out of cycles is indistinguishable from any other `SysTransient`
        // failure, so all of them must back off rather than retry in a tight loop
        assert_eq!(
            retry_policy(&rejected(RejectCode::SysTransient)),
            C2CRetryPolicy::RetryAfterDelay
        );
        // A trapping callee and one missing the method are likewise indistinguishable
        assert_eq!(
            retry_policy(&rejected(RejectCode::CanisterError)),
            C2CRetryPolicy::RetryAfterDelay
        );
        assert_eq!(retry_policy(&rejected(RejectCode::SysFatal)), C2CRetryPolicy::RetryAfterDelay);
    }

    #[test]
    fn calls_with_an_unknown_outcome_are_retried_immediately() {
        assert_eq!(
            retry_policy(&rejected(RejectCode::SysUnknown)),
            C2CRetryPolicy::RetryImmediately
        );
    }

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
