use candid::Principal;
use serde::{Serialize, Serializer};

pub use human_readable_derive::HumanReadable;

pub fn to_human_readable_string<T>(value: &T) -> Result<String, String>
where
    T: ToHumanReadable,
    T::Target: Serialize,
{
    serde_json::to_string(&value.to_human_readable()).map_err(|e| format!("Serialization error: {e:?}"))
}

pub trait ToHumanReadable {
    type Target;

    fn to_human_readable(&self) -> Self::Target;
}

impl ToHumanReadable for Principal {
    type Target = String;

    fn to_human_readable(&self) -> Self::Target {
        self.to_string()
    }
}

impl ToHumanReadable for () {
    type Target = String;

    fn to_human_readable(&self) -> Self::Target {
        "".to_string()
    }
}

pub struct HumanReadablePrincipal(Principal);

impl From<Principal> for HumanReadablePrincipal {
    fn from(value: Principal) -> Self {
        HumanReadablePrincipal(value)
    }
}

impl Serialize for HumanReadablePrincipal {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.to_string().serialize(serializer)
    }
}
