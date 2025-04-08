use crate::CanisterId;
use ic_cdk::call::RejectCode;
use oc_error_codes::{OCError, OCErrorCode};
use serde::Serialize;
use std::fmt::{Debug, Formatter};

pub type Error = Box<dyn std::error::Error + Send + Sync + 'static>;

#[derive(Serialize)]
pub struct C2CError {
    canister_id: CanisterId,
    method_name: String,
    reject_code: RejectCode,
    message: String,
}

impl C2CError {
    pub fn new(canister_id: CanisterId, method_name: &str, reject_code: RejectCode, message: String) -> Self {
        C2CError {
            canister_id,
            method_name: method_name.to_string(),
            reject_code,
            message,
        }
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
            .finish()
    }
}

impl From<C2CError> for OCError {
    fn from(value: C2CError) -> Self {
        OCErrorCode::C2CError.with_json(&value)
    }
}
