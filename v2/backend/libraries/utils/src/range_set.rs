use range_set::RangeSet;
use std::ops::RangeInclusive;
use types::{MessageIndex, MessageIndexRange};

pub fn insert_ranges_and_return_added(
    range_set: &mut RangeSet<[RangeInclusive<u32>; 2]>,
    message_ranges: &[MessageIndexRange],
    min_message_index: MessageIndex,
    max_message_index: MessageIndex,
) -> Vec<MessageIndex> {
    let added = insert_ranges_impl(range_set, message_ranges, min_message_index, max_message_index);
    added.iter().map(|m| m.into()).collect()
}

pub fn insert_ranges(
    range_set: &mut RangeSet<[RangeInclusive<u32>; 2]>,
    message_ranges: &[MessageIndexRange],
    min_message_index: MessageIndex,
    max_message_index: MessageIndex,
) -> bool {
    let added = insert_ranges_impl(range_set, message_ranges, min_message_index, max_message_index);
    !added.is_empty()
}

pub fn convert_to_message_index_ranges(range_set: RangeSet<[RangeInclusive<u32>; 2]>) -> Vec<MessageIndexRange> {
    range_set
        .into_smallvec()
        .into_iter()
        .map(|r| MessageIndexRange {
            from: (*r.start()).into(),
            to: (*r.end()).into(),
        })
        .collect()
}

fn insert_ranges_impl(
    range_set: &mut RangeSet<[RangeInclusive<u32>; 2]>,
    message_ranges: &[MessageIndexRange],
    min_message_index: MessageIndex,
    max_message_index: MessageIndex,
) -> RangeSet<[RangeInclusive<u32>; 2]> {
    let mut added: RangeSet<[RangeInclusive<u32>; 2]> = RangeSet::new();
    for range in message_ranges
        .iter()
        .filter(|r| min_message_index <= r.from && r.from <= r.to && r.to <= max_message_index)
        .map(|r| r.from.into()..=r.to.into())
    {
        added.insert_range(range.clone());
        if let Some(intersection) = range_set.insert_range(range) {
            for r in intersection.into_smallvec().into_iter() {
                added.remove_range(r);
            }
        }
    }
    added
}
