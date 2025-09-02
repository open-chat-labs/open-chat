use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Error;
use std::io::Write;

pub fn serialize<T: Serialize>(value: T) -> Result<Vec<u8>, Error> {
    let mut bytes = Vec::new();
    let mut serializer = serde_json::Serializer::with_formatter(&mut bytes, LargeNumbersAsStringsFormatter);
    value.serialize(&mut serializer)?;
    Ok(bytes)
}

pub fn serialize_to_string<T: Serialize>(value: T) -> Result<String, Error> {
    let bytes = serialize(value)?;
    unsafe { Ok(String::from_utf8_unchecked(bytes)) }
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

struct LargeNumbersAsStringsFormatter;

const MAX_SAFE_INT: u64 = 9007199254740991;

impl LargeNumbersAsStringsFormatter {
    fn write_str<W: ?Sized + Write>(&mut self, writer: &mut W, value: &str) -> std::io::Result<()> {
        use serde_json::ser::Formatter;

        self.begin_string(writer)?;
        self.write_string_fragment(writer, value)?;
        self.end_string(writer)
    }
}

impl serde_json::ser::Formatter for LargeNumbersAsStringsFormatter {
    fn write_i64<W: ?Sized + Write>(&mut self, writer: &mut W, value: i64) -> std::io::Result<()> {
        if value.abs() as u64 > MAX_SAFE_INT {
            self.write_str(writer, &value.to_string())
        } else {
            let mut buffer = itoa::Buffer::new();
            let s = buffer.format(value);
            writer.write_all(s.as_bytes())
        }
    }

    fn write_i128<W: ?Sized + Write>(&mut self, writer: &mut W, value: i128) -> std::io::Result<()> {
        if value.abs() as u128 > MAX_SAFE_INT as u128 {
            self.write_str(writer, &value.to_string())
        } else {
            let mut buffer = itoa::Buffer::new();
            let s = buffer.format(value);
            writer.write_all(s.as_bytes())
        }
    }

    fn write_u64<W: ?Sized + Write>(&mut self, writer: &mut W, value: u64) -> std::io::Result<()> {
        if value > MAX_SAFE_INT {
            self.write_str(writer, &value.to_string())
        } else {
            let mut buffer = itoa::Buffer::new();
            let s = buffer.format(value);
            writer.write_all(s.as_bytes())
        }
    }

    fn write_u128<W: ?Sized + Write>(&mut self, writer: &mut W, value: u128) -> std::io::Result<()> {
        if value > MAX_SAFE_INT as u128 {
            self.write_str(writer, &value.to_string())
        } else {
            let mut buffer = itoa::Buffer::new();
            let s = buffer.format(value);
            writer.write_all(s.as_bytes())
        }
    }
}

pub fn serialize_empty() -> Vec<u8> {
    Vec::new()
}
pub fn deserialize_empty(_bytes: Vec<u8>) {}
