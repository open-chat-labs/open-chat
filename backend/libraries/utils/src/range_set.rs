use range_set::RangeSet as _RangeSet;
use std::ops::RangeInclusive;
use types::MessageIndexRange;

pub type RangeSet = _RangeSet<[RangeInclusive<u32>; 2]>;

pub fn insert_ranges(range_set: &mut RangeSet, message_ranges: &[MessageIndexRange]) -> RangeSet {
    let mut added: RangeSet = RangeSet::new();
    for range in message_ranges.iter().map(|r| r.from.into()..=r.to.into()) {
        added.insert_range(range.clone());
        if let Some(intersection) = range_set.insert_range(range) {
            for r in intersection.into_smallvec() {
                added.remove_range(r);
            }
        }
    }
    added
}

pub fn convert_to_message_index_ranges(range_set: RangeSet) -> Vec<MessageIndexRange> {
    range_set
        .into_smallvec()
        .into_iter()
        .map(|r| MessageIndexRange {
            from: (*r.start()).into(),
            to: (*r.end()).into(),
        })
        .collect()
}
