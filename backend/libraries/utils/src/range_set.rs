use range_set::RangeSet as _RangeSet;
use std::ops::RangeInclusive;

pub type RangeSet = _RangeSet<[RangeInclusive<u32>; 2]>;
