use range_set::RangeSet;
use std::ops::RangeInclusive;
use types::{MessageIndex, MessageIndexRange};

pub fn insert_ranges(
    range_set: &mut RangeSet<[RangeInclusive<u32>; 2]>,
    message_ranges: &[MessageIndexRange],
    min_message_index: MessageIndex,
    max_message_index: MessageIndex,
) -> bool {
    let mut updated = false;
    for range in message_ranges
        .iter()
        .filter(|r| min_message_index <= r.from && r.from <= r.to && r.to <= max_message_index)
        .map(|r| r.from.into()..=r.to.into())
    {
        if let Some(intersection) = range_set.insert_range(range.clone()) {
            let input = RangeSet::from(range);
            if input != intersection {
                updated = true;
            }
        } else {
            updated = true;
        }
    }
    updated
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
