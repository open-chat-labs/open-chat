use crate::lifecycle::READER_WRITER_BUFFER_SIZE;
use crate::memory::get_upgrades_memory;
use crate::state;
use ic_cdk::pre_upgrade;
use ic_stable_structures::writer::{BufferedWriter, Writer};
use serde::Serialize;

#[pre_upgrade]
fn pre_upgrade() {
    let mut memory = get_upgrades_memory();
    let writer = BufferedWriter::new(READER_WRITER_BUFFER_SIZE, Writer::new(&mut memory, 0));
    let mut serializer = rmp_serde::Serializer::new(writer).with_struct_map();

    let state = state::take();
    state.serialize(&mut serializer).unwrap()
}
