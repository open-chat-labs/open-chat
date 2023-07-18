use candid::types::Serializer;
use candid::CandidType;
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt::{Debug, Formatter};
use std::marker::PhantomData;
use std::ops::RangeInclusive;

type RangeSetInner = range_set::RangeSet<[RangeInclusive<u32>; 2]>;

pub struct RangeSet<T> {
    ranges: RangeSetInner,
    phantom: PhantomData<T>,
}

impl<T: Into<u32> + From<u32>> RangeSet<T> {
    pub fn insert(&mut self, value: T) {
        self.ranges.insert(value.into());
    }

    pub fn merge(mut self, other: Self) -> RangeSet<T> {
        for range in other.ranges.as_ref().iter() {
            self.ranges.insert_range(range.clone());
        }
        self
    }
}

impl<T> RangeSet<T> {
    pub fn is_empty(&self) -> bool {
        self.ranges.is_empty()
    }
}

impl<T: From<u32>> RangeSet<T> {
    pub fn iter(&self) -> impl Iterator<Item = T> + '_ {
        self.ranges.iter().map(T::from)
    }
}

impl<T> Default for RangeSet<T> {
    fn default() -> Self {
        RangeSet {
            ranges: RangeSetInner::new(),
            phantom: PhantomData,
        }
    }
}

impl<T: CandidType + Into<u32>> CandidType for RangeSet<T> {
    #[allow(deprecated)]
    fn _ty() -> candid::types::Type {
        Vec::<Range>::_ty()
    }

    fn idl_serialize<S>(&self, serializer: S) -> Result<(), S::Error>
    where
        S: Serializer,
    {
        let vec: Vec<Range> = self.into();
        vec.idl_serialize(serializer)
    }
}

impl<T: Into<u32>> Serialize for RangeSet<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let vec: Vec<Range> = self.into();
        vec.serialize(serializer)
    }
}

impl<'de, T: From<u32>> Deserialize<'de> for RangeSet<T> {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let vec: Vec<Range> = Vec::deserialize(deserializer)?;
        Ok(vec.into())
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
struct Range {
    start: u32,
    end: u32,
}

impl<T: Into<u32>> From<&RangeSet<T>> for Vec<Range> {
    fn from(value: &RangeSet<T>) -> Self {
        value
            .ranges
            .as_ref()
            .iter()
            .map(|r| Range {
                start: *r.start(),
                end: *r.end(),
            })
            .collect()
    }
}

impl<T: From<u32>> From<Vec<Range>> for RangeSet<T> {
    fn from(value: Vec<Range>) -> Self {
        let mut range_set = RangeSet::default();
        for range in value {
            range_set.ranges.insert_range(range.into());
        }
        range_set
    }
}

impl From<Range> for RangeInclusive<u32> {
    fn from(value: Range) -> Self {
        RangeInclusive::new(value.start, value.end)
    }
}

impl<T: Into<u32>> Debug for RangeSet<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let ranges: Vec<Range> = self.into();

        ranges.fmt(f)
    }
}

impl<T> Clone for RangeSet<T> {
    fn clone(&self) -> Self {
        RangeSet {
            ranges: self.ranges.clone(),
            phantom: PhantomData,
        }
    }
}
