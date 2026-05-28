use rmp_serde::{decode, encode};
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::io::{Read, Write};

pub fn serialize<T, W>(value: T, mut writer: W) -> Result<(), encode::Error>
where
    T: Serialize,
    W: Write,
{
    let mut ser = rmp_serde::Serializer::new(ErasedWriter { inner: &mut writer })
        .with_struct_map()
        .with_large_ints_as_strings();

    value.serialize(&mut ser).map(|_| ())
}

pub fn deserialize<T, R>(mut reader: R) -> Result<T, decode::Error>
where
    T: DeserializeOwned,
    R: Read,
{
    rmp_serde::from_read(ErasedReader { inner: &mut reader })
}

pub fn serialize_to_vec<T: Serialize>(value: T) -> Result<Vec<u8>, encode::Error> {
    let mut bytes = Vec::new();
    serialize(value, &mut bytes)?;
    Ok(bytes)
}

pub fn serialize_then_unwrap<T: Serialize>(value: T) -> Vec<u8> {
    serialize_to_vec(value).unwrap()
}

pub fn deserialize_then_unwrap<T: DeserializeOwned>(bytes: &[u8]) -> T {
    deserialize(bytes).unwrap()
}

pub fn deserialize_owned_then_unwrap<T: DeserializeOwned>(bytes: impl AsRef<[u8]>) -> T {
    deserialize(bytes.as_ref()).unwrap()
}

pub fn serialize_empty() -> Vec<u8> {
    Vec::new()
}
pub fn deserialize_empty(_bytes: Vec<u8>) {}

/// A non-generic reader that wraps any `Read` implementation via a trait object.
///
/// Using this as the concrete type passed to `rmp_serde::from_read` ensures that all callers
/// of `msgpack::deserialize` share the **same** `rmp_serde::Deserializer<ErasedReader>`
/// monomorphization, regardless of the original reader type `R`. Without this, each distinct
/// `R` would produce a separate monomorphization of every serde visitor function, leaving each
/// with only one call site and causing wasm-opt's single-use inliner to inline them all into
/// the top-level `visit_enum` function — ballooning it past ICP's 1,000,000 complexity limit.
struct ErasedReader<'a> {
    inner: &'a mut dyn Read,
}

impl Read for ErasedReader<'_> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.inner.read(buf)
    }
}

/// A non-generic writer that wraps any `Write` implementation via a trait object.
///
/// Mirrors `ErasedReader`: ensures all callers of `msgpack::serialize` share the same
/// `rmp_serde::Serializer<ErasedWriter>` monomorphization regardless of the underlying
/// writer type `W`, preventing wasm-opt from creating per-writer serde monomorphizations.
struct ErasedWriter<'a> {
    inner: &'a mut dyn Write,
}

impl Write for ErasedWriter<'_> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.inner.write(buf)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}
