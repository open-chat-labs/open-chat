use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Error;
use std::io::Write;

pub fn serialize<T: Serialize>(value: T) -> Result<Vec<u8>, Error> {
    let mut bytes = Vec::new();
    let mut serializer = serde_json::Serializer::with_formatter(&mut bytes, Formatter);
    value.serialize(&mut serializer)?;
    Ok(bytes)
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

pub fn deserialize_owned_then_unwrap<T: DeserializeOwned>(bytes: impl AsRef<[u8]>) -> T {
    serde_json::from_slice(bytes.as_ref()).unwrap()
}

struct Formatter;

impl Formatter {
    fn write_string<W: ?Sized + Write, V: ToString>(&mut self, writer: &mut W, value: V) -> std::io::Result<()> {
        use serde_json::ser::Formatter;

        self.begin_string(writer)?;
        self.write_string_fragment(writer, &value.to_string())?;
        self.end_string(writer)
    }
}

impl serde_json::ser::Formatter for Formatter {
    fn write_i64<W: ?Sized + Write>(&mut self, writer: &mut W, value: i64) -> std::io::Result<()> {
        self.write_string(writer, value)
    }

    fn write_i128<W: ?Sized + Write>(&mut self, writer: &mut W, value: i128) -> std::io::Result<()> {
        self.write_string(writer, value)
    }

    fn write_u64<W: ?Sized + Write>(&mut self, writer: &mut W, value: u64) -> std::io::Result<()> {
        self.write_string(writer, value)
    }

    fn write_u128<W: ?Sized + Write>(&mut self, writer: &mut W, value: u128) -> std::io::Result<()> {
        self.write_string(writer, value)
    }
}
