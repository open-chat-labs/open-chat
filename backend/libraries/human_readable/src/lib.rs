use candid::CandidType;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::cell::Cell;
use std::ops::Deref;

thread_local! {
    static HUMAN_READABLE_ENABLED: Cell<bool> = Cell::default()
}

pub fn to_human_readable_string<T: Serialize>(value: &T) -> Result<String, String> {
    HUMAN_READABLE_ENABLED.with(|h| h.set(true));
    let json = serde_json::to_string(value).map_err(|e| format!("Serialization error: {e:?}"));
    HUMAN_READABLE_ENABLED.with(|h| h.set(false));
    json
}

pub trait ToHumanReadable {
    type Target: Serialize;

    fn to_human_readable(&self) -> Self::Target;
}

#[derive(Clone, Debug)]
pub struct HumanReadable<T> {
    inner: T,
}

impl<T> HumanReadable<T> {
    pub fn value(self) -> T {
        self.inner
    }
}

impl<T> Deref for HumanReadable<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl<T> From<T> for HumanReadable<T> {
    fn from(value: T) -> Self {
        Self { inner: value }
    }
}

impl<T: ToHumanReadable + Serialize> Serialize for HumanReadable<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        if HUMAN_READABLE_ENABLED.with(|h| h.get()) {
            self.inner.to_human_readable().serialize(serializer)
        } else {
            self.inner.serialize(serializer)
        }
    }
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for HumanReadable<T> {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let inner = T::deserialize(deserializer)?;

        Ok(Self { inner })
    }
}

impl<T: CandidType> CandidType for HumanReadable<T> {
    fn _ty() -> candid::types::Type {
        T::_ty()
    }

    fn idl_serialize<S>(&self, serializer: S) -> Result<(), S::Error>
    where
        S: candid::types::Serializer,
    {
        self.inner.idl_serialize(serializer)
    }
}
