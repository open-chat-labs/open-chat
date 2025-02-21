use std::collections::HashSet;

pub fn encode_as_bitflags(inputs: impl Iterator<Item = u8>) -> u32 {
    let mut set = HashSet::new();
    let mut output = 0u32;
    for input in inputs {
        if set.insert(input) {
            output = output.checked_add(2u32.pow(input as u32)).unwrap();
        }
    }
    output
}

pub fn decode_from_bitflags(bits: u32) -> Vec<u8> {
    let mut output = Vec::new();
    let mut remaining = bits;
    // Iterate over decreasing powers of 2, if the remaining value is >= to that power of 2, then
    // insert the exponent into the set and subtract the power of 2 from the remaining value.
    for i in (0..32).rev() {
        let pow2 = 1 << i;
        if let Some(r) = remaining.checked_sub(pow2) {
            remaining = r;
            output.push(i);
        }
    }
    debug_assert_eq!(remaining, 0);
    output
}

#[test]
fn encode_decode_roundtrip_bitflags_tests() {
    for _ in 0..10 {
        let input = rand::random();
        let decoded = decode_from_bitflags(input);
        let output = encode_as_bitflags(decoded.into_iter());
        assert_eq!(input, output);
    }
}
