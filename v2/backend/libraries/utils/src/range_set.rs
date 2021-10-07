use candid::types::{Compound, Field, Label, Serializer, Type};
use candid::CandidType;
use range_set::RangeSet as _RangeSet;
use serde::Deserialize;
use std::ops::{Deref, DerefMut, RangeInclusive};
use types::MessageIndexRange;

type RangeSetInner = _RangeSet<[RangeInclusive<u32>; 2]>;

#[derive(Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct RangeSet(pub RangeSetInner);

impl Default for RangeSet {
    fn default() -> Self {
        RangeSet::new()
    }
}

impl RangeSet {
    pub fn new() -> RangeSet {
        RangeSet(RangeSetInner::new())
    }
}

impl From<RangeSet> for RangeSetInner {
    fn from(value: RangeSet) -> Self {
        value.0
    }
}

impl Deref for RangeSet {
    type Target = RangeSetInner;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for RangeSet {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

pub fn insert_ranges(range_set: &mut RangeSet, message_ranges: &[MessageIndexRange]) -> RangeSet {
    let mut added: RangeSet = RangeSet::new();
    for range in message_ranges.iter().map(|r| r.from.into()..=r.to.into()) {
        added.insert_range(range.clone());
        if let Some(intersection) = range_set.insert_range(range) {
            for r in intersection.into_smallvec().into_iter() {
                added.remove_range(r);
            }
        }
    }
    added
}

pub fn convert_to_message_index_ranges(range_set: RangeSet) -> Vec<MessageIndexRange> {
    range_set
        .0
        .into_smallvec()
        .into_iter()
        .map(|r| MessageIndexRange {
            from: (*r.start()).into(),
            to: (*r.end()).into(),
        })
        .collect()
}

#[derive(CandidType, Deserialize)]
struct RangeInc {
    start: u32,
    end: u32,
}

impl CandidType for RangeSet {
    fn _ty() -> Type {
        Type::Vec(Box::new(Type::Record(vec![
            Field {
                id: Label::Named("end".to_string()),
                ty: Type::Nat32,
            },
            Field {
                id: Label::Named("start".to_string()),
                ty: Type::Nat32,
            },
        ])))
    }

    fn idl_serialize<S>(&self, serializer: S) -> Result<(), S::Error>
    where
        S: Serializer,
    {
        let ranges = self.0.clone().into_smallvec();
        let mut ser = serializer.serialize_vec(ranges.len())?;
        for r in ranges.into_iter().map(|r| RangeInc {
            start: *r.start(),
            end: *r.end(),
        }) {
            ser.serialize_element(&r)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::{Decode, Encode};

    #[test]
    fn candid_serialize_deserialize() {
        let mut original = RangeSet::new();
        original.insert_range(1..=10);
        original.insert_range(15..=20);
        original.insert_range(100..=200);
        original.insert_range(301..=301);

        let bytes = Encode!(&original).unwrap();

        let de = Decode!(&bytes, RangeSet);

        println!("{:?}", de);

        assert_eq!(original, de.unwrap());
    }
}
