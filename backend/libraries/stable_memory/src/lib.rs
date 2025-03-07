use ic_cdk::stable::WASM_PAGE_SIZE_IN_BYTES;
use ic_stable_structures::reader::{BufferedReader, Reader};
use ic_stable_structures::writer::{BufferedWriter, Writer};
use ic_stable_structures::Memory;
use std::cmp::min;
use std::io::{Read, Write};

const MAX_READER_WRITER_BUFFER_SIZE: usize = 4 * 1024 * 1024; // 4MB

pub fn get_reader<M: Memory>(memory: &M) -> impl Read + '_ {
    BufferedReader::new(buffer_size(memory), Reader::new(memory, 0))
}

pub fn get_writer<M: Memory>(memory: &mut M) -> impl Write + '_ {
    BufferedWriter::new(buffer_size(memory), Writer::new(memory, 0))
}

fn buffer_size<M: Memory>(memory: &M) -> usize {
    let memory_size = memory.size() * WASM_PAGE_SIZE_IN_BYTES;

    match usize::try_from(memory_size) {
        Ok(size) => min(size / 4, MAX_READER_WRITER_BUFFER_SIZE),
        Err(_) => MAX_READER_WRITER_BUFFER_SIZE,
    }
}
