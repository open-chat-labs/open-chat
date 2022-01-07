use candid::CandidType;
use serde::{Deserialize, Serialize};

// This is needed in cases where we would otherwise be returning an Option<Option<T>> where it would
// not be possible to tell which layer is None after converting to JSON
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum OptionUpdates<T> {
    None,
    SetToNone,
    SetToSome(T),
}

impl<T> OptionUpdates<T> {
    pub fn from_updates(option: Option<T>) -> OptionUpdates<T> {
        if let Some(value) = option {
            OptionUpdates::SetToSome(value)
        } else {
            OptionUpdates::SetToNone
        }
    }

    pub fn is_some(&self) -> bool {
        !self.is_none()
    }

    pub fn is_none(&self) -> bool {
        matches!(self, OptionUpdates::None)
    }
}

impl<T> Default for OptionUpdates<T> {
    fn default() -> Self {
        OptionUpdates::None
    }
}
