use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::ops::Deref;

// This is needed in cases where we would otherwise be returning an Option<Option<T>> where it would
// not be possible to tell which layer is None after converting to JSON
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct WrappedOption<T> {
    value: Option<T>,
}

impl<T> Deref for WrappedOption<T> {
    type Target = Option<T>;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}

impl<T> From<Option<T>> for WrappedOption<T> {
    fn from(value: Option<T>) -> Self {
        WrappedOption { value }
    }
}
