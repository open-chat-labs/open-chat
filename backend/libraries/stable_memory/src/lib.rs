use ic_cdk::api::stable::{BufferedStableReader, BufferedStableWriter};
use serde::{de::DeserializeOwned, Serialize};
use std::cmp::min;
use std::error::Error;

const WASM_PAGE_SIZE_BYTES: usize = 64 * 1024; // 64KB

pub fn serialize_to_stable_memory<S: Serialize>(state: S, buffer_size: usize) -> Result<(), impl Error> {
    let writer = BufferedStableWriter::new(buffer_size);
    serializer::serialize(state, writer)
}

pub fn deserialize_from_stable_memory<S: DeserializeOwned>(max_buffer_size: usize) -> Result<S, impl Error> {
    let stable_size = ic_cdk::api::stable::stable_size() as usize * WASM_PAGE_SIZE_BYTES;
    let buffer_size = min(max_buffer_size, stable_size);
    let reader = BufferedStableReader::new(buffer_size);
    serializer::deserialize(reader)
}
