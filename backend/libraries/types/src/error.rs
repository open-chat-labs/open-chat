use crate::CanisterId;
use ic_cdk::call::RejectCode;
use oc_error_codes::{OCError, OCErrorCode};
use serde::Serialize;
use std::fmt::{Debug, Formatter};

pub type Error = Box<dyn std::error::Error + Send + Sync + 'static>;

// Whether a failed c2c call is worth retrying. This is determined when the error is first
// converted from the CDK error (see `utils::canister::convert_cdk_error`), because that is the
// only point at which we have the CDK's own view of the failure - once flattened into a reject
// code plus a message the detail is lost.
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
    // Used for errors which did not originate from a failed CDK call, so the reject code is all we
    // have to go on
    pub fn from_reject_code(reject_code: RejectCode) -> Self {
        match reject_code {
            RejectCode::DestinationInvalid | RejectCode::CanisterReject => C2CRetryPolicy::DoNotRetry,
            _ => C2CRetryPolicy::RetryImmediately,
        }
    }
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
