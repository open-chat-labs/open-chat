use serde::{Deserialize, Serialize};
use serde_json::Error;

pub fn serialize<T: Serialize>(value: T) -> Result<Vec<u8>, Error> {
    serde_json::to_vec(&value)
}

pub fn deserialize<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> Result<T, Error> {
    serde_json::from_slice(bytes)
}

pub fn serialize_then_unwrap<T: Serialize>(value: T) -> Vec<u8> {
    serialize(value).unwrap()
}

pub fn deserialize_then_unwrap<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> T {
    deserialize(bytes).unwrap()
}
