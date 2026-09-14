use serde::de::value::{MapAccessDeserializer, SeqAccessDeserializer};
use serde::de::{MapAccess, SeqAccess, Visitor};
use serde::ser::SerializeStruct;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use stable_memory_map::{ChatEventKeyPrefix, KeyPrefix, MessageEventIndexesKeyPrefix, with_map, with_map_mut};
use std::fmt::Formatter;
use std::io::Cursor;
use types::{EventIndex, MessageIndex};

// The number of event indexes in each chunk. This determines each chunk's key, so it can't be
// changed once chunks have been written.
const CHUNK_SIZE: usize = 128;

// Maps each message's `MessageIndex` to its `EventIndex`.
//
// The event indexes are stored in stable memory in chunks of `CHUNK_SIZE`, keyed by chunk index. A
// chunk is written once it is full and is never modified after that, since a message's event index
// never changes. The latest chunk, which isn't yet full, is kept on the heap, so most threads never
// touch stable memory.
//
// Each chunk is encoded as a sequence of unsigned LEB128 values, being its first event index
// followed by the difference between each event index and the previous one. Most messages directly
// follow the previous message, so most event indexes take a single byte.
#[derive(Default)]
pub struct MessageEventIndexes {
    // The event indexes of the messages which aren't in stable memory, starting from the message
    // index `chunk_first_event_indexes.len() * CHUNK_SIZE`. This holds fewer than `CHUNK_SIZE`
    // entries, other than for lists which haven't yet been migrated, for which the full chunks are
    // moved into stable memory in batches by `migrate_to_stable_memory`. This can be simplified
    // once every list has been migrated.
    on_heap: Vec<EventIndex>,
    // The first event index of each chunk in stable memory, so that an event index can be mapped to
    // a message index by reading a single chunk
    chunk_first_event_indexes: Vec<EventIndex>,
}

impl MessageEventIndexes {
    pub fn len(&self) -> usize {
        self.stable_memory_len() + self.on_heap.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn push(&mut self, events_prefix: &ChatEventKeyPrefix, message_index: MessageIndex, event_index: EventIndex) {
        assert_eq!(self.len(), usize::from(message_index));

        self.on_heap.push(event_index);

        // The heap always starts at a chunk boundary, so it now holds exactly one full chunk
        if self.on_heap.len() == CHUNK_SIZE {
            let prefix = MessageEventIndexesKeyPrefix::from(events_prefix);
            let chunk_index = self.chunk_first_event_indexes.len() as u32;
            with_map_mut(|m| m.insert(prefix.create_key(&chunk_index), encode_chunk(&self.on_heap)));
            self.chunk_first_event_indexes.push(self.on_heap[0]);
            self.on_heap.clear();
        }
    }

    pub fn get(&self, events_prefix: &ChatEventKeyPrefix, message_index: MessageIndex) -> Option<EventIndex> {
        let index = usize::from(message_index);
        let stable_memory_len = self.stable_memory_len();

        if index < stable_memory_len {
            self.read_chunk(events_prefix, index / CHUNK_SIZE).nth(index % CHUNK_SIZE)
        } else {
            self.on_heap.get(index - stable_memory_len).copied()
        }
    }

    // The number of messages whose event index satisfies `predicate`, which must hold for every
    // event index up to some point and for none after it (as with `slice::partition_point`)
    pub fn partition_point<P: Fn(EventIndex) -> bool>(&self, events_prefix: &ChatEventKeyPrefix, predicate: P) -> usize {
        let chunk_count = self.chunk_first_event_indexes.len();

        if chunk_count == 0 || self.on_heap.first().is_some_and(|e| predicate(*e)) {
            return self.stable_memory_len() + self.on_heap.partition_point(|e| predicate(*e));
        }

        // The partition point is within the last chunk whose first event index satisfies the predicate
        let Some(chunk_index) = self
            .chunk_first_event_indexes
            .partition_point(|e| predicate(*e))
            .checked_sub(1)
        else {
            return 0;
        };
        let within_chunk = self
            .read_chunk(events_prefix, chunk_index)
            .take_while(|e| predicate(*e))
            .count();

        (chunk_index * CHUNK_SIZE) + within_chunk
    }

    // Iterates over the event indexes from the latest message back to the first, reading each chunk
    // from stable memory only once the iterator reaches it
    pub fn iter_rev(&self, events_prefix: &ChatEventKeyPrefix) -> impl Iterator<Item = EventIndex> + '_ {
        let events_prefix = events_prefix.clone();

        self.on_heap
            .iter()
            .rev()
            .copied()
            .chain((0..self.chunk_first_event_indexes.len()).rev().flat_map(move |chunk_index| {
                let mut chunk: Vec<_> = self.read_chunk(&events_prefix, chunk_index).collect();
                chunk.reverse();
                chunk
            }))
    }

    // Copies every chunk in stable memory onto the heap, so that they are included when the chat is
    // serialized to be imported into a community. The community moves them back into stable memory,
    // under the new channel's prefix, via `migrate_to_stable_memory`.
    //
    // The chunks are left in stable memory, and will simply be overwritten with the same values if
    // they are migrated again.
    pub fn copy_to_heap(&mut self, events_prefix: &ChatEventKeyPrefix) {
        let chunk_count = self.chunk_first_event_indexes.len();
        if chunk_count == 0 {
            return;
        }

        let prefix = MessageEventIndexesKeyPrefix::from(events_prefix);
        let start = prefix.create_key(&0);
        let end = prefix.create_key(&(chunk_count as u32));
        let mut event_indexes = Vec::with_capacity(self.len());

        with_map(|m| {
            for (key, bytes) in m.range(start..end) {
                assert_eq!(key.chunk_index() as usize, event_indexes.len() / CHUNK_SIZE);
                event_indexes.extend(decode_chunk(bytes));
            }
        });
        assert_eq!(event_indexes.len(), self.stable_memory_len());

        event_indexes.append(&mut self.on_heap);
        self.on_heap = event_indexes;
        self.chunk_first_event_indexes = Vec::new();
    }

    // Moves up to `max_count` full chunks from the heap into stable memory, returning how many were
    // moved
    pub fn migrate_to_stable_memory(&mut self, events_prefix: &ChatEventKeyPrefix, max_count: usize) -> usize {
        let count = self.on_heap_count_to_migrate().min(max_count);
        if count == 0 {
            return 0;
        }

        let prefix = MessageEventIndexesKeyPrefix::from(events_prefix);
        let mut entries = Vec::with_capacity(count);
        for chunk in self.on_heap.chunks_exact(CHUNK_SIZE).take(count) {
            let chunk_index = self.chunk_first_event_indexes.len() as u32;
            entries.push((prefix.create_key(&chunk_index), encode_chunk(chunk)));
            self.chunk_first_event_indexes.push(chunk[0]);
        }
        // The chunk indexes are increasing, so the entries are already in key order
        with_map_mut(|m| m.insert_many(entries));

        self.on_heap.drain(..count * CHUNK_SIZE);
        if self.on_heap.len() < CHUNK_SIZE {
            // Release the rest of the allocation, keeping enough space to fill the latest chunk
            self.on_heap.shrink_to(CHUNK_SIZE);
        }

        count
    }

    // The number of full chunks on the heap which are yet to be moved into stable memory
    pub fn on_heap_count_to_migrate(&self) -> usize {
        self.on_heap.len() / CHUNK_SIZE
    }

    fn stable_memory_len(&self) -> usize {
        self.chunk_first_event_indexes.len() * CHUNK_SIZE
    }

    fn read_chunk(&self, events_prefix: &ChatEventKeyPrefix, chunk_index: usize) -> impl Iterator<Item = EventIndex> {
        let key = MessageEventIndexesKeyPrefix::from(events_prefix).create_key(&(chunk_index as u32));
        let bytes = with_map(|m| m.get(key)).unwrap_or_else(|| panic!("Message event indexes chunk not found: {chunk_index}"));
        decode_chunk(bytes)
    }
}

fn encode_chunk(event_indexes: &[EventIndex]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(event_indexes.len() + 4);
    let mut previous = 0;
    for event_index in event_indexes.iter().map(|e| u32::from(*e)) {
        leb128::write::unsigned(&mut bytes, u64::from(event_index - previous)).unwrap();
        previous = event_index;
    }
    bytes
}

fn decode_chunk(bytes: Vec<u8>) -> impl Iterator<Item = EventIndex> {
    let len = bytes.len() as u64;
    let mut cursor = Cursor::new(bytes);
    let mut previous = 0;
    std::iter::from_fn(move || {
        if cursor.position() == len {
            return None;
        }
        previous += leb128::read::unsigned(&mut cursor).unwrap() as u32;
        Some(EventIndex::from(previous))
    })
}

// Serialized as a plain list of event indexes while nothing is in stable memory, which is the format
// used before the event indexes were moved into stable memory. So a list which hasn't yet been
// migrated, or which has been copied onto the heap to be imported into a community, can be read by a
// canister which expects that format.
impl Serialize for MessageEventIndexes {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        if self.chunk_first_event_indexes.is_empty() {
            self.on_heap.serialize(serializer)
        } else {
            let mut state = serializer.serialize_struct("MessageEventIndexes", 2)?;
            state.serialize_field("h", &self.on_heap)?;
            state.serialize_field("c", &self.chunk_first_event_indexes)?;
            state.end()
        }
    }
}

impl<'de> Deserialize<'de> for MessageEventIndexes {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(MessageEventIndexesVisitor)
    }
}

struct MessageEventIndexesVisitor;

#[derive(Deserialize)]
struct MessageEventIndexesFields {
    #[serde(rename = "h")]
    on_heap: Vec<EventIndex>,
    #[serde(rename = "c")]
    chunk_first_event_indexes: Vec<EventIndex>,
}

impl<'de> Visitor<'de> for MessageEventIndexesVisitor {
    type Value = MessageEventIndexes;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a list of event indexes or a map")
    }

    fn visit_seq<A: SeqAccess<'de>>(self, seq: A) -> Result<Self::Value, A::Error> {
        Ok(MessageEventIndexes {
            on_heap: Vec::deserialize(SeqAccessDeserializer::new(seq))?,
            chunk_first_event_indexes: Vec::new(),
        })
    }

    fn visit_map<A: MapAccess<'de>>(self, map: A) -> Result<Self::Value, A::Error> {
        let fields = MessageEventIndexesFields::deserialize(MapAccessDeserializer::new(map))?;
        Ok(MessageEventIndexes {
            on_heap: fields.on_heap,
            chunk_first_event_indexes: fields.chunk_first_event_indexes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::{Rng, RngExt, rng};
    use stable_memory_map::{BaseKey, BaseKeyPrefix};
    use test_case::test_case;
    use types::{ChannelId, Chat};

    #[test_case(0; "empty")]
    #[test_case(1; "one")]
    #[test_case(CHUNK_SIZE - 1; "one less than a chunk")]
    #[test_case(CHUNK_SIZE; "one chunk")]
    #[test_case(CHUNK_SIZE + 1; "one more than a chunk")]
    #[test_case(10 * CHUNK_SIZE + 17; "many chunks")]
    fn matches_vec(count: usize) {
        init_stable_memory_map();
        let events_prefix = events_prefix(1);
        let mut message_event_indexes = MessageEventIndexes::default();
        let model = random_event_indexes(count);

        for (message_index, event_index) in model.iter().enumerate() {
            message_event_indexes.push(&events_prefix, MessageIndex::from(message_index as u32), *event_index);
        }

        assert_eq!(message_event_indexes.chunk_first_event_indexes.len(), count / CHUNK_SIZE);
        assert_eq!(message_event_indexes.on_heap.len(), count % CHUNK_SIZE);
        assert_matches_model(&message_event_indexes, &events_prefix, &model);
    }

    #[test]
    fn chunks_are_encoded_as_leb128_deltas() {
        init_stable_memory_map();
        let events_prefix = events_prefix(1);
        let mut message_event_indexes = MessageEventIndexes::default();
        let model: Vec<_> = (0..CHUNK_SIZE as u32)
            .map(|i| EventIndex::from(if i == 0 { 1000 } else { 1000 + i + (i / 100) * 200 }))
            .collect();

        for (message_index, event_index) in model.iter().enumerate() {
            message_event_indexes.push(&events_prefix, MessageIndex::from(message_index as u32), *event_index);
        }

        let key = MessageEventIndexesKeyPrefix::from(&events_prefix).create_key(&0);
        let bytes = with_map(|m| m.get(key)).unwrap();
        // 1000 takes 2 bytes, the jump of 201 takes 2 bytes, and every other delta of 1 takes 1 byte
        assert_eq!(bytes.len(), 2 + 2 + (CHUNK_SIZE - 2));
        assert_eq!(&bytes[..3], &[0xe8, 0x07, 0x01]);
        assert_eq!(decode_chunk(bytes).collect::<Vec<_>>(), model);
    }

    #[test]
    fn serialized_as_vec_if_nothing_in_stable_memory() {
        init_stable_memory_map();
        let events_prefix = events_prefix(1);
        let model = random_event_indexes(3 * CHUNK_SIZE + 5);

        // Deserialize from the previous format, then check reads work before and after migrating
        let bytes = msgpack::serialize_then_unwrap(&model);
        let mut message_event_indexes: MessageEventIndexes = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(msgpack::serialize_then_unwrap(&message_event_indexes), bytes);
        assert_eq!(message_event_indexes.on_heap_count_to_migrate(), 3);
        assert_matches_model(&message_event_indexes, &events_prefix, &model);

        assert_eq!(message_event_indexes.migrate_to_stable_memory(&events_prefix, 2), 2);
        assert_eq!(message_event_indexes.on_heap_count_to_migrate(), 1);
        assert_matches_model(&message_event_indexes, &events_prefix, &model);

        assert_eq!(message_event_indexes.migrate_to_stable_memory(&events_prefix, 2), 1);
        assert_eq!(message_event_indexes.migrate_to_stable_memory(&events_prefix, 2), 0);
        assert_eq!(message_event_indexes.on_heap.len(), 5);
        assert_matches_model(&message_event_indexes, &events_prefix, &model);

        // Once there are chunks in stable memory, the serialized form is a map
        let bytes = msgpack::serialize_then_unwrap(&message_event_indexes);
        assert!(msgpack::deserialize::<Vec<EventIndex>, _>(bytes.as_slice()).is_err());
        let deserialized: MessageEventIndexes = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(deserialized.on_heap, message_event_indexes.on_heap);
        assert_eq!(
            deserialized.chunk_first_event_indexes,
            message_event_indexes.chunk_first_event_indexes
        );
        assert_matches_model(&deserialized, &events_prefix, &model);
    }

    #[test]
    fn copy_to_heap_then_migrate_under_new_prefix() {
        init_stable_memory_map();
        let events_prefix = events_prefix(1);
        let new_events_prefix = events_prefix_for_thread(2, 5);
        let mut message_event_indexes = MessageEventIndexes::default();
        let mut model = random_event_indexes(5 * CHUNK_SIZE + 3);

        for (message_index, event_index) in model.iter().enumerate() {
            message_event_indexes.push(&events_prefix, MessageIndex::from(message_index as u32), *event_index);
        }

        message_event_indexes.copy_to_heap(&events_prefix);
        assert!(message_event_indexes.chunk_first_event_indexes.is_empty());
        assert_eq!(message_event_indexes.on_heap, model);

        // This is what the community receives
        let bytes = msgpack::serialize_then_unwrap(&message_event_indexes);
        assert_eq!(bytes, msgpack::serialize_then_unwrap(&model));
        let mut imported: MessageEventIndexes = msgpack::deserialize_then_unwrap(&bytes);

        while imported.migrate_to_stable_memory(&new_events_prefix, 2) > 0 {}
        assert_eq!(imported.chunk_first_event_indexes.len(), 5);
        assert_matches_model(&imported, &new_events_prefix, &model);

        let mut next_event_index = u32::from(*model.last().unwrap());
        for _ in 0..CHUNK_SIZE {
            next_event_index += 1 + rng().random_range(0..3);
            let event_index = EventIndex::from(next_event_index);
            imported.push(&new_events_prefix, MessageIndex::from(model.len() as u32), event_index);
            model.push(event_index);
        }
        assert_eq!(imported.chunk_first_event_indexes.len(), 6);
        assert_matches_model(&imported, &new_events_prefix, &model);

        // The original chunks are untouched
        message_event_indexes.migrate_to_stable_memory(&events_prefix, usize::MAX);
        assert_matches_model(&message_event_indexes, &events_prefix, &model[..5 * CHUNK_SIZE + 3]);
        assert_eq!(chunk_count_in_stable_memory(&events_prefix), 5);
        assert_eq!(chunk_count_in_stable_memory(&new_events_prefix), 6);
    }

    fn assert_matches_model(
        message_event_indexes: &MessageEventIndexes,
        events_prefix: &ChatEventKeyPrefix,
        model: &[EventIndex],
    ) {
        assert_eq!(message_event_indexes.len(), model.len());

        for (message_index, event_index) in model.iter().enumerate() {
            assert_eq!(
                message_event_indexes.get(events_prefix, MessageIndex::from(message_index as u32)),
                Some(*event_index)
            );
        }
        assert_eq!(
            message_event_indexes.get(events_prefix, MessageIndex::from(model.len() as u32)),
            None
        );

        assert!(message_event_indexes.iter_rev(events_prefix).eq(model.iter().rev().copied()));

        let max_event_index = model.last().map_or(0, |e| u32::from(*e) + 2);
        for event_index in (0..=max_event_index).map(EventIndex::from) {
            assert_eq!(
                message_event_indexes.partition_point(events_prefix, |e| e < event_index),
                model.partition_point(|e| *e < event_index)
            );
            assert_eq!(
                message_event_indexes.partition_point(events_prefix, |e| e <= event_index),
                model.partition_point(|e| *e <= event_index)
            );
        }
    }

    fn random_event_indexes(count: usize) -> Vec<EventIndex> {
        let mut event_index = 0u32;
        (0..count)
            .map(|_| {
                event_index += match rng().next_u32() % 100 {
                    0..85 => 1,
                    85..98 => rng().random_range(2..10),
                    _ => rng().random_range(10..1000),
                };
                EventIndex::from(event_index)
            })
            .collect()
    }

    fn chunk_count_in_stable_memory(events_prefix: &ChatEventKeyPrefix) -> usize {
        let prefix = MessageEventIndexesKeyPrefix::from(events_prefix);
        let base_prefix = BaseKeyPrefix::from(prefix.clone());
        with_map(|m| {
            m.range(prefix.create_key(&0)..)
                .take_while(|(k, _)| BaseKey::from(k.clone()).matches_prefix(&base_prefix))
                .count()
        })
    }

    fn events_prefix(channel_id: u32) -> ChatEventKeyPrefix {
        ChatEventKeyPrefix::new_from_chat(chat(channel_id), None)
    }

    fn events_prefix_for_thread(channel_id: u32, root_message_index: u32) -> ChatEventKeyPrefix {
        ChatEventKeyPrefix::new_from_chat(chat(channel_id), Some(MessageIndex::from(root_message_index)))
    }

    fn chat(channel_id: u32) -> Chat {
        Chat::Channel(candid::Principal::anonymous().into(), ChannelId::from(channel_id))
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
