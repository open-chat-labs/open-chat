use candid::CandidType;
use serde::{Deserialize, Serialize};

// This is needed when we would otherwise use an Option<Option<T>> in which case it would not be
// possible to tell which layer is None when represented as JSON
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub enum OptionUpdate<T> {
    #[default]
    NoChange,
    SetToNone,
    SetToSome(T),
}

impl<T> OptionUpdate<T> {
    pub fn from_update(option: Option<T>) -> OptionUpdate<T> {
        if let Some(value) = option {
            OptionUpdate::SetToSome(value)
        } else {
            OptionUpdate::SetToNone
        }
    }

    pub fn expand(self) -> Option<Option<T>> {
        match self {
            OptionUpdate::NoChange => None,
            OptionUpdate::SetToNone => Some(None),
            OptionUpdate::SetToSome(value) => Some(Some(value)),
        }
    }

    pub fn has_update(&self) -> bool {
        !matches!(self, OptionUpdate::NoChange)
    }

    pub fn as_ref(&self) -> OptionUpdate<&T> {
        match self {
            OptionUpdate::NoChange => OptionUpdate::NoChange,
            OptionUpdate::SetToNone => OptionUpdate::SetToNone,
            OptionUpdate::SetToSome(value) => OptionUpdate::SetToSome(value),
        }
    }

    pub fn map<F, R>(self, f: F) -> OptionUpdate<R>
    where
        F: FnOnce(T) -> R,
    {
        match self {
            OptionUpdate::NoChange => OptionUpdate::NoChange,
            OptionUpdate::SetToNone => OptionUpdate::SetToNone,
            OptionUpdate::SetToSome(value) => OptionUpdate::SetToSome(f(value)),
        }
    }

    pub fn apply_to(self, opt: Option<T>) -> Option<T> {
        match self {
            OptionUpdate::NoChange => opt,
            OptionUpdate::SetToNone => None,
            OptionUpdate::SetToSome(value) => Some(value),
        }
    }
}
