use rmp_serde::{decode, encode};
use serde::{Deserialize, Serialize};

pub fn serialize<T: Serialize>(value: T) -> Result<Vec<u8>, encode::Error> {
    rmp_serde::to_vec_named(&value)
}

pub fn deserialize<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> Result<T, decode::Error> {
    rmp_serde::from_slice(bytes)
}

pub fn serialize_then_unwrap<T: Serialize>(value: T) -> Vec<u8> {
    serialize(value).unwrap()
}

pub fn deserialize_then_unwrap<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> T {
    deserialize(bytes).unwrap()
}
