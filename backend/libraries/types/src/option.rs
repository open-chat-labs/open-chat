use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

// This is needed when we would otherwise use an Option<Option<T>> in which case it would not be
// possible to tell which layer is None when represented as JSON
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
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

    pub fn is_empty(&self) -> bool {
        !self.has_update()
    }
}

macro_rules! option_update {
    ($name:ident, $event_type:ty) => {
        #[ts_export]
        #[doc = " @default NoChange"]
        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        pub enum $name {
            NoChange,
            SetToNone,
            SetToSome($event_type),
        }
    };
}

option_update!(OptionUpdateString, String);
option_update!(OptionUpdateU64, u64);
option_update!(OptionUpdateU128, u128);
option_update!(OptionUpdateAccessGate, crate::AccessGate);
option_update!(OptionUpdateAccessGateConfig, crate::AccessGateConfig);
option_update!(OptionUpdateAirdropConfig, crate::AirdropConfig);
option_update!(OptionUpdateDocument, crate::Document);
option_update!(OptionUpdateFrozenGroupInfo, crate::FrozenGroupInfo);
option_update!(OptionUpdateGroupPermissionRole, crate::GroupPermissionRole);
option_update!(OptionUpdateGroupSubtype, crate::GroupSubtype);
option_update!(OptionUpdateOptionalMessagePermissions, crate::OptionalMessagePermissions);
option_update!(OptionUpdatePinNumberSettings, crate::PinNumberSettings);
option_update!(OptionUpdateStreakInsurance, crate::StreakInsurance);
option_update!(OptionUpdateVideoCall, crate::VideoCall);
