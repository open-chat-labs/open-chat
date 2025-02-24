use rmp_serde::{decode, encode};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use types::Fallback;

pub fn serialize<T, W>(value: T, writer: W) -> Result<(), encode::Error>
where
    T: Serialize,
    W: Write,
{
    let mut ser = rmp_serde::Serializer::new(writer)
        .with_struct_map()
        .with_large_ints_as_strings();

    value.serialize(&mut ser).map(|_| ())
}

pub fn deserialize<T, R>(reader: R) -> Result<T, decode::Error>
where
    T: DeserializeOwned,
    R: Read,
{
    rmp_serde::from_read(reader)
}

pub fn serialize_to_vec<T: Serialize>(value: T) -> Result<Vec<u8>, encode::Error> {
    let mut bytes = Vec::new();
    serialize(value, &mut bytes)?;
    Ok(bytes)
}

pub fn deserialize_from_slice<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> Result<T, decode::Error> {
    rmp_serde::from_slice(bytes)
}

pub fn serialize_then_unwrap<T: Serialize>(value: T) -> Vec<u8> {
    serialize_to_vec(value).unwrap()
}

pub fn deserialize_then_unwrap<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> T {
    deserialize_from_slice(bytes).unwrap()
}

pub fn deserialize_with_fallback<'a, T>(bytes: &'a [u8]) -> T
where
    T: Fallback + Deserialize<'a>,
    T::FallbackType: Deserialize<'a>,
{
    if let Ok(value) = deserialize_from_slice(bytes) {
        value
    } else {
        deserialize_from_slice::<T::FallbackType>(bytes).unwrap().into()
    }
}
