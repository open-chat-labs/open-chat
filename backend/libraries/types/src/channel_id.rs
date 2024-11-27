use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use ts_rs::TS;

#[derive(Serialize, Deserialize, CandidType, TS, Clone, Copy, Debug, Eq)]
pub struct ChannelId(u128);

impl Display for ChannelId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl From<u128> for ChannelId {
    fn from(value: u128) -> Self {
        ChannelId(value)
    }
}

impl From<u32> for ChannelId {
    fn from(value: u32) -> Self {
        ChannelId(value as u128)
    }
}

impl ChannelId {
    pub fn as_u128(self) -> u128 {
        self.0
    }

    pub fn as_u32(self) -> u32 {
        self.0 as u32
    }
}

impl PartialEq<ChannelId> for ChannelId {
    fn eq(&self, other: &ChannelId) -> bool {
        self.as_u32() == other.as_u32()
    }
}

impl PartialOrd<ChannelId> for ChannelId {
    fn partial_cmp(&self, other: &ChannelId) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ChannelId {
    fn cmp(&self, other: &Self) -> Ordering {
        self.as_u32().cmp(&other.as_u32())
    }
}

impl Hash for ChannelId {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.as_u32().hash(state);
    }
}

#[test]
fn channel_id_u128_matches_u32() {
    use std::collections::{BTreeSet, HashSet};

    let input_128: u128 = rand::random();
    let channel_id_u128 = ChannelId::from(input_128);
    let channel_id_u32 = ChannelId::from(input_128 as u32);

    assert_eq!(channel_id_u128, channel_id_u32);

    let mut hashset = HashSet::new();
    hashset.insert(channel_id_u128);
    assert!(hashset.contains(&channel_id_u32));

    let mut btreeset = BTreeSet::new();
    btreeset.insert(channel_id_u128);
    assert!(btreeset.contains(&channel_id_u32));
}
