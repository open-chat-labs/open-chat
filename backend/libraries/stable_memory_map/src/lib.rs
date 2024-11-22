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
    DirectChat = 1,
    GroupChat = 2,
    Channel = 3,
    DirectChatThread = 4,
    GroupChatThread = 5,
    ChannelThread = 6,
    ChatMember = 7,
    CommunityMember = 8,
}

impl From<u8> for KeyType {
    fn from(value: u8) -> Self {
        match value {
            1 => KeyType::DirectChat,
            2 => KeyType::GroupChat,
            3 => KeyType::Channel,
            4 => KeyType::DirectChatThread,
            5 => KeyType::GroupChatThread,
            6 => KeyType::ChannelThread,
            7 => KeyType::ChatMember,
            8 => KeyType::CommunityMember,
            _ => unreachable!(),
        }
    }
}
