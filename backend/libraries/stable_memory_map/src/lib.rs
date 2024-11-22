//! If you want to store data in this map and be able to iterate over it in order, then the keys
//! must maintain their ordering when represented as bytes, since the keys in the map are ordered
//! by their bytes.

use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

struct StableMemoryMap {
    map: StableBTreeMap<Vec<u8>, Vec<u8>, Memory>,
}

thread_local! {
    static MAP: RefCell<Option<StableMemoryMap>> = RefCell::default();
}

pub fn init(memory: Memory) {
    MAP.set(Some(StableMemoryMap {
        map: StableBTreeMap::init(memory),
    }));
}

pub fn with_map<F: FnOnce(&StableBTreeMap<Vec<u8>, Vec<u8>, Memory>) -> R, R>(f: F) -> R {
    MAP.with_borrow(|m| f(&m.as_ref().unwrap().map))
}

pub fn with_map_mut<F: FnOnce(&mut StableBTreeMap<Vec<u8>, Vec<u8>, Memory>) -> R, R>(f: F) -> R {
    MAP.with_borrow_mut(|m| f(&mut m.as_mut().unwrap().map))
}

#[derive(Copy, Clone)]
#[repr(u8)]
pub enum KeyType {
    DirectChatEvent = 1,
    GroupChatEvent = 2,
    ChannelEvent = 3,
    DirectChatThreadEvent = 4,
    GroupChatThreadEvent = 5,
    ChannelThreadEvent = 6,
    ChatMember = 7,
    CommunityMember = 8,
}

impl From<u8> for KeyType {
    fn from(value: u8) -> Self {
        match value {
            1 => KeyType::DirectChatEvent,
            2 => KeyType::GroupChatEvent,
            3 => KeyType::ChannelEvent,
            4 => KeyType::DirectChatThreadEvent,
            5 => KeyType::GroupChatThreadEvent,
            6 => KeyType::ChannelThreadEvent,
            7 => KeyType::ChatMember,
            8 => KeyType::CommunityMember,
            _ => unreachable!(),
        }
    }
}
