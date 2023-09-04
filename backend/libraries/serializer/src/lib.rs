use serde::{de::DeserializeOwned, Deserialize, Deserializer, Serialize};
use std::error::Error;
use std::io::{Read, Write};

pub fn serialize<T, W>(value: T, writer: W) -> Result<(), impl Error>
where
    T: Serialize,
    W: Write,
{
    let mut serializer = rmp_serde::Serializer::new(writer).with_struct_map();
    value.serialize(&mut serializer).map(|_| ())
}

pub fn deserialize<T, R>(reader: R) -> Result<T, impl Error>
where
    T: DeserializeOwned,
    R: Read,
{
    let mut deserializer = rmp_serde::Deserializer::new(reader);
    T::deserialize(&mut deserializer)
}

pub fn ok_or_default<'de, V, D>(deserializer: D) -> Result<V, D::Error>
where
    V: Deserialize<'de> + Default,
    D: Deserializer<'de>,
{
    Ok(V::deserialize(deserializer).unwrap_or_default())
}
