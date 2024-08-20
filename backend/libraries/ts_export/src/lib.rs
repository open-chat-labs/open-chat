use ic_principal::Principal;
use serde::{Deserialize, Deserializer};
use std::fmt::Display;
use std::str::FromStr;

pub use ts_export_macros::generate_ts_method;
pub use ts_export_macros::ts_export;

pub fn deserialize_number_from_string<'de, T, D>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: FromStr + serde::Deserialize<'de>,
    <T as FromStr>::Err: Display,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrInt<T> {
        String(String),
        Number(T),
    }

    match StringOrInt::<T>::deserialize(deserializer)? {
        StringOrInt::String(s) => s.parse::<T>().map_err(serde::de::Error::custom),
        StringOrInt::Number(i) => Ok(i),
    }
}

#[ts_export]
#[ts(type = "")]
pub struct ArrayBuffer {
    buffer: 
}
