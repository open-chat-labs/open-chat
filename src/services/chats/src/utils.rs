use std::ops::RangeInclusive;
use range_set::RangeSet;
use smallvec::SmallVec;

pub fn range_set_to_vec(range_set: RangeSet<[RangeInclusive<u32>; 2]>) -> Vec<[u32; 2]> {
    range_set
        .into_smallvec()
        .into_vec()
        .into_iter()
        .map(|r| [*r.start(), *r.end()])
        .collect()
}

pub fn vec_to_range_set(vec: Vec<[u32; 2]>) -> RangeSet<[RangeInclusive<u32>; 2]> {
    let ranges: Vec<_> = vec.into_iter().map(|r| RangeInclusive::new(r[0], r[1])).collect();
    let small_vec = SmallVec::from_vec(ranges);
    RangeSet::from_ranges(small_vec).unwrap()
}

pub fn get_memory_usage() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        (core::arch::wasm32::memory_size(0) * 65536) as u64
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        // This branch won't actually ever be taken
        1024 * 1024 * 100 // 100Mb
    }
}
