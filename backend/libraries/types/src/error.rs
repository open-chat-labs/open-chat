use crate::CanisterId;
use ic_cdk::call::{CallErrorExt, Error as CdkError, RejectCode};
use oc_error_codes::{OCError, OCErrorCode};
use serde::Serialize;
use std::fmt::{Debug, Formatter};

pub type Error = Box<dyn std::error::Error + Send + Sync + 'static>;

// Whether a failed c2c call is worth retrying. This is determined when the error is first
// converted from the CDK error (see `C2CError::from_cdk_error`), because that is the only point
// at which we have the CDK's own view of the failure - once flattened into a reject code plus a
// message the detail is lost.
#[derive(Serialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum C2CRetryPolicy {
    // The call will fail the same way however many times we retry it
    DoNotRetry,
    // The failure was transient and an immediate retry may succeed
    RetryImmediately,
    // The failure may resolve, but not straight away (eg. the callee needs topping up with cycles),
    // so retrying immediately would just burn our own cycles
    RetryAfterDelay,
}

impl C2CRetryPolicy {
    // Determines whether a failed c2c call is worth retrying.
    //
    // Note we deliberately do not look at the reject message - the IC does not expose the fine
    // grained error codes (eg. IC0207) to canisters, only the coarse `RejectCode`, so any code
    // found in the message is there at the replica's discretion and cannot be relied upon.
    pub fn from_cdk_error(error: &CdkError) -> Self {
        // Failures which will recur however many times we retry
        let permanent = match error {
            // The caller and callee disagree on the response type, which retrying cannot fix
            CdkError::CandidDecodeFailed(_) => true,
            CdkError::CallRejected(rejected) => matches!(
                rejected.reject_code(),
                // The callee does not exist, or explicitly rejected the call
                Ok(RejectCode::DestinationInvalid | RejectCode::CanisterReject)
            ),
            _ => false,
        };

        if permanent {
            C2CRetryPolicy::DoNotRetry
        } else if callee_is_stopped(error) || (error.is_immediately_retryable() && !maybe_callee_out_of_cycles(error)) {
            C2CRetryPolicy::RetryImmediately
        } else {
            C2CRetryPolicy::RetryAfterDelay
        }
    }

    // Used for errors which did not originate from a failed CDK call, so the reject code is all we
    // have to go on
    pub fn from_reject_code(reject_code: RejectCode) -> Self {
        match reject_code {
            RejectCode::DestinationInvalid | RejectCode::CanisterReject => C2CRetryPolicy::DoNotRetry,
            _ => C2CRetryPolicy::RetryImmediately,
        }
    }
}

// A stopped callee surfaces as `CanisterError`, which we otherwise cannot tell apart from the
// callee trapping, so it would wait the full delay. But a stopped canister is nearly always one
// which is mid upgrade and will be back within seconds, and canisters are upgraded routinely, so
// that would stall event delivery to a canister every time it is upgraded. Reading the reject
// message is fair game here in a way that reading an IC error code out of it is not - this is the
// replica's own text for the rejection, not a code the IC only ever sends to the frontend.
fn callee_is_stopped(error: &CdkError) -> bool {
    matches!(error, CdkError::CallRejected(rejected)
        if matches!(rejected.reject_code(), Ok(RejectCode::CanisterError))
            && matches!(rejected.reject_message(), m if m.contains("is stopped") || m.contains("is stopping")))
}

// `CallErrorExt::is_immediately_retryable` treats every `SysTransient` failure as safe to retry
// straight away, but a callee which is out of cycles surfaces as `SysTransient` too (`IC0207` maps
// to `SysTransient`) and retrying that in a tight loop only burns our own cycles until someone
// tops the callee up. We can no longer tell the two apart, so we treat all of them as needing a
// delay. If the IC ever exposes error codes to canisters this can be narrowed back down.
fn maybe_callee_out_of_cycles(error: &CdkError) -> bool {
    matches!(error, CdkError::CallRejected(rejected) if matches!(rejected.reject_code(), Ok(RejectCode::SysTransient)))
}

#[derive(Serialize, Clone)]
pub struct C2CError {
    canister_id: CanisterId,
    method_name: String,
    reject_code: RejectCode,
    message: String,
    retry_policy: C2CRetryPolicy,
}

impl C2CError {
    // Converts the CDK's error into ours. Every failed CDK call must be converted here rather than
    // flattened into a reject code plus a message at the call site, since the retry policy can only
    // be determined while the CDK's own view of the failure is still intact.
    pub fn from_cdk_error(canister_id: CanisterId, method_name: &str, error: CdkError) -> Self {
        let retry_policy = C2CRetryPolicy::from_cdk_error(&error);

        let (reject_code, message) = match error {
            CdkError::InsufficientLiquidCycleBalance(cb) => (RejectCode::SysTransient, cb.to_string()),
            CdkError::CallPerformFailed(f) => (RejectCode::SysTransient, f.to_string()),
            CdkError::CallRejected(r) => (
                r.reject_code().unwrap_or(RejectCode::SysUnknown),
                r.reject_message().to_string(),
            ),
            CdkError::CandidDecodeFailed(f) => (RejectCode::CanisterReject, f.to_string()),
        };

        C2CError::new_with_retry_policy(canister_id, method_name, reject_code, message, retry_policy)
    }

    pub fn new(canister_id: CanisterId, method_name: &str, reject_code: RejectCode, message: String) -> Self {
        C2CError::new_with_retry_policy(
            canister_id,
            method_name,
            reject_code,
            message,
            C2CRetryPolicy::from_reject_code(reject_code),
        )
    }

    pub fn new_with_retry_policy(
        canister_id: CanisterId,
        method_name: &str,
        reject_code: RejectCode,
        message: String,
        retry_policy: C2CRetryPolicy,
    ) -> Self {
        C2CError {
            canister_id,
            method_name: method_name.to_string(),
            reject_code,
            message,
            retry_policy,
        }
    }

    pub fn retry_policy(&self) -> C2CRetryPolicy {
        self.retry_policy
    }

    pub fn canister_id(&self) -> CanisterId {
        self.canister_id
    }

    pub fn method_name(&self) -> &str {
        &self.method_name
    }

    pub fn reject_code(&self) -> RejectCode {
        self.reject_code
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl Debug for C2CError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("C2CError")
            .field("canister_id", &self.canister_id.to_string())
            .field("method_name", &self.method_name)
            .field("reject_code", &self.reject_code)
            .field("message", &self.message)
            .field("retry_policy", &self.retry_policy)
            .finish()
    }
}

impl From<C2CError> for OCError {
    fn from(value: C2CError) -> Self {
        OCErrorCode::C2CError.with_json(&value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_cdk::call::{CallRejected, InsufficientLiquidCycleBalance};

    fn rejected(reject_code: RejectCode) -> CdkError {
        // The reject message deliberately contains no IC error code, since we can no longer rely
        // on one being present
        CdkError::CallRejected(CallRejected::with_rejection(reject_code as u32, "rejected".to_string()))
    }

    #[test]
    fn failures_which_will_always_recur_are_not_retried() {
        assert_eq!(
            C2CRetryPolicy::from_cdk_error(&rejected(RejectCode::DestinationInvalid)),
            C2CRetryPolicy::DoNotRetry
        );
        assert_eq!(
            C2CRetryPolicy::from_cdk_error(&rejected(RejectCode::CanisterReject)),
            C2CRetryPolicy::DoNotRetry
        );
    }

    #[test]
    fn failures_which_may_resolve_later_are_retried_after_a_delay() {
        // A callee which is out of cycles is indistinguishable from any other `SysTransient`
        // failure, so all of them must back off rather than retry in a tight loop
        assert_eq!(
            C2CRetryPolicy::from_cdk_error(&rejected(RejectCode::SysTransient)),
            C2CRetryPolicy::RetryAfterDelay
        );
        // A trapping callee and one missing the method are likewise indistinguishable
        assert_eq!(
            C2CRetryPolicy::from_cdk_error(&rejected(RejectCode::CanisterError)),
            C2CRetryPolicy::RetryAfterDelay
        );
        assert_eq!(
            C2CRetryPolicy::from_cdk_error(&rejected(RejectCode::SysFatal)),
            C2CRetryPolicy::RetryAfterDelay
        );
    }

    // Canisters are stopped whenever they are upgraded, so making these wait the full delay stalls
    // event delivery to a canister every time it is upgraded. The message is verbatim what the
    // replica sent when an integration test stopped a canister mid conversation.
    #[test]
    fn a_stopped_callee_is_retried_immediately() {
        let stopped = CdkError::CallRejected(CallRejected::with_rejection(
            RejectCode::CanisterError as u32,
            "Canister mzsit-hx777-77775-qaaba-cai is stopped".to_string(),
        ));

        assert_eq!(C2CRetryPolicy::from_cdk_error(&stopped), C2CRetryPolicy::RetryImmediately);
    }

    #[test]
    fn a_trapping_callee_is_still_backed_off() {
        let trapped = CdkError::CallRejected(CallRejected::with_rejection(
            RejectCode::CanisterError as u32,
            "Canister x trapped explicitly: something went wrong".to_string(),
        ));

        assert_eq!(C2CRetryPolicy::from_cdk_error(&trapped), C2CRetryPolicy::RetryAfterDelay);
    }

    #[test]
    fn calls_with_an_unknown_outcome_are_retried_immediately() {
        assert_eq!(
            C2CRetryPolicy::from_cdk_error(&rejected(RejectCode::SysUnknown)),
            C2CRetryPolicy::RetryImmediately
        );
    }

    // `from_cdk_error` is the only conversion which sees the CDK error, so these are the cases the
    // reject code alone would get wrong. Each of these used to reach the c2c call sites as
    // `RetryImmediately` and be retried every round.
    #[test]
    fn conversion_keeps_the_retry_policy_the_reject_code_alone_would_lose() {
        let cases = [
            // Our own liquid cycle balance is too low to perform the call, so retrying before
            // topping up would just fail the same way
            (
                CdkError::InsufficientLiquidCycleBalance(InsufficientLiquidCycleBalance {
                    available: 1u32.into(),
                    required: 100u32.into(),
                }),
                RejectCode::SysTransient,
            ),
            // The callee is out of cycles, which surfaces as an ordinary `SysTransient` reject
            (rejected(RejectCode::SysTransient), RejectCode::SysTransient),
            // The callee trapped
            (rejected(RejectCode::CanisterError), RejectCode::CanisterError),
        ];

        for (cdk_error, expected_reject_code) in cases {
            let error = C2CError::from_cdk_error(CanisterId::anonymous(), "method", cdk_error);

            assert_eq!(error.reject_code(), expected_reject_code);
            assert_eq!(error.retry_policy(), C2CRetryPolicy::RetryAfterDelay);
            // The reject code on its own cannot tell these apart from a genuinely transient failure
            assert_eq!(
                C2CRetryPolicy::from_reject_code(error.reject_code()),
                C2CRetryPolicy::RetryImmediately
            );
        }
    }
}
