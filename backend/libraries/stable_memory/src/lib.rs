use ic_cdk::api::stable::{BufferedStableReader, BufferedStableWriter, WASM_PAGE_SIZE_IN_BYTES};
use ic_stable_structures::reader::{BufferedReader, Reader};
use ic_stable_structures::writer::{BufferedWriter, Writer};
use ic_stable_structures::Memory;
use serde::{de::DeserializeOwned, Serialize};
use std::cmp::min;
use std::error::Error;
use std::io::{Read, Write};

const MAX_READER_WRITER_BUFFER_SIZE: usize = 1024 * 1024; // 1MB

pub fn serialize_to_stable_memory<S: Serialize>(state: S, buffer_size: usize) -> Result<(), impl Error> {
    let writer = BufferedStableWriter::new(buffer_size);
    serializer::serialize(state, writer)
}

pub fn deserialize_from_stable_memory<S: DeserializeOwned>(max_buffer_size: usize) -> Result<S, impl Error> {
    let stable_size = ic_cdk::api::stable::stable_size() as usize * WASM_PAGE_SIZE_IN_BYTES;
    let buffer_size = min(max_buffer_size, stable_size);
    let reader = BufferedStableReader::new(buffer_size);
    serializer::deserialize(reader)
}

pub fn get_reader<M: Memory>(memory: &M) -> impl Read + '_ {
    BufferedReader::new(buffer_size(memory), Reader::new(memory, 0))
}

pub fn get_writer<M: Memory>(memory: &mut M) -> impl Write + '_ {
    BufferedWriter::new(MAX_READER_WRITER_BUFFER_SIZE, Writer::new(memory, 0))
}

fn buffer_size<M: Memory>(memory: &M) -> usize {
    let memory_size = memory.size() * WASM_PAGE_SIZE_IN_BYTES as u64;

    match usize::try_from(memory_size) {
        Ok(size) => min(size / 4, MAX_READER_WRITER_BUFFER_SIZE),
        Err(_) => MAX_READER_WRITER_BUFFER_SIZE,
    }
}
