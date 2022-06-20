use serde::{Deserialize, Serialize};

pub fn serialize<T: Serialize>(value: T) -> Vec<u8> {
    rmp_serde::to_vec_named(&value).unwrap()
}

pub fn deserialize<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> T {
    rmp_serde::from_slice(bytes).unwrap()
}
