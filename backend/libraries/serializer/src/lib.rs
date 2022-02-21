use rmp_serde::{Deserializer, Serializer};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::error::Error;

pub fn serialize<T>(value: T) -> Result<Vec<u8>, impl Error>
where
    T: Serialize,
{
    let mut serializer = Serializer::new(Vec::new()).with_struct_map();
    match value.serialize(&mut serializer) {
        Ok(_) => Ok(serializer.into_inner()),
        Err(e) => Err(e),
    }
}

pub fn deserialize<T>(bytes: &[u8]) -> Result<T, impl Error>
where
    T: DeserializeOwned,
{
    let mut deserializer = Deserializer::new(bytes);
    T::deserialize(&mut deserializer)
}

pub fn unwrap_option<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    let option: Option<T> = Option::deserialize(deserializer)?;

    Ok(option.unwrap())
}
