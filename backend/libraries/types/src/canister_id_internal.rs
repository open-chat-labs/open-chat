use crate::CanisterId;
use serde::{Deserialize, Serialize};

const VERSION_MASK: u8 = 0b11100000;
const ZEROES_MASK: u8 = 0b00011111;
const FLAGS_V1: u8 = 0b00100000;
const FLAGS_V2: u8 = 0b01000000;
const FLAGS_V3: u8 = 0b01100000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CanisterIdInternal(Vec<u8>);

impl From<CanisterId> for CanisterIdInternal {
    fn from(value: CanisterId) -> Self {
        let bytes = value.as_slice();

        if let Ok(array) = <[u8; 10]>::try_from(bytes) {
            array.into()
        } else {
            let mut result = Vec::with_capacity(bytes.len() + 1);
            result.push(0);
            result.extend_from_slice(bytes);
            CanisterIdInternal(result)
        }
    }
}

impl From<[u8; 10]> for CanisterIdInternal {
    fn from(value: [u8; 10]) -> Self {
        let ones_at_end_count = value
            .iter()
            .rev()
            .enumerate()
            .find(|(_, &b)| b != 1)
            .map(|(i, _)| i)
            .unwrap_or(10);

        let mut zeroes_bits_first_5 = 0;
        let mut zeroes_bits_last_5 = 0;

        let mut filtered = Vec::new();
        for (index, byte) in value[..10 - ones_at_end_count].iter().enumerate() {
            if *byte == 0 {
                if index < 5 {
                    zeroes_bits_first_5 += 1 << (4 - index);
                } else {
                    zeroes_bits_last_5 += 1 << (9 - index);
                }
            } else {
                filtered.push(*byte);
            }
        }

        let mut result: Vec<u8>;

        match (zeroes_bits_first_5 != 0, zeroes_bits_last_5 != 0) {
            (false, false) => {
                result = Vec::with_capacity(1 + filtered.len());
                result.push(FLAGS_V1);
            }
            (true, false) => {
                result = Vec::with_capacity(1 + filtered.len());
                result.push(FLAGS_V1 + zeroes_bits_first_5);
            }
            (false, true) => {
                result = Vec::with_capacity(1 + filtered.len());
                result.push(FLAGS_V2 + zeroes_bits_last_5);
            }
            (true, true) => {
                result = Vec::with_capacity(2 + filtered.len());
                result.push(FLAGS_V3 + zeroes_bits_first_5);
                result.push(zeroes_bits_last_5);
            }
        }

        result.extend(filtered);

        CanisterIdInternal(result)
    }
}

impl From<CanisterIdInternal> for CanisterId {
    fn from(CanisterIdInternal(bytes): CanisterIdInternal) -> Self {
        let first_byte = bytes[0];
        let version = first_byte & VERSION_MASK;

        match version {
            0 => CanisterId::from_slice(&bytes[1..]),
            FLAGS_V1 | FLAGS_V2 | FLAGS_V3 => {
                let prefix_length = if version == FLAGS_V3 { 2 } else { 1 };
                let (prefix, remainder) = bytes.split_at(prefix_length);
                let mut bytes_to_add = remainder.to_vec();
                bytes_to_add.reverse();

                let has_zeroes_in_first_5 = version & FLAGS_V1 != 0;
                let has_zeroes_in_last_5 = version & FLAGS_V2 != 0;

                let zeroes_first_5 = if has_zeroes_in_first_5 { prefix[0] & ZEROES_MASK } else { 0 };
                let zeroes_last_5 = if has_zeroes_in_last_5 { prefix[prefix.len() - 1] & ZEROES_MASK } else { 0 };

                let mut result = [0; 10];
                for (index, output) in result.iter_mut().enumerate() {
                    if index < 5 {
                        if has_flag(zeroes_first_5, index + 3) {
                            // This byte should remain as 0
                            continue;
                        }
                    } else if has_flag(zeroes_last_5, index - 2) {
                        // This byte should remain as 0
                        continue;
                    }

                    if let Some(byte) = bytes_to_add.pop() {
                        *output = byte
                    } else {
                        *output = 1;
                    }
                }
                CanisterId::from_slice(&result)
            }
            _ => unreachable!(),
        }
    }
}

fn has_flag(bits: u8, index: usize) -> bool {
    bits & (1 << (7 - index)) != 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case("4bkt6-4aaaa-aaaaf-aaaiq-cai", 4)]
    #[test_case("3skqk-iqaaa-aaaaf-aaa3q-cai", 4)]
    #[test_case("maxdq-biaaa-aaaaf-aofsq-cai", 4)]
    #[test_case("jjjzx-uqaaa-aaaaf-bgsoq-cai", 4)]
    #[test_case("c7bwc-3aaaa-aaaaf-atqiq-cai", 4)]
    #[test_case("dpttu-xaaaa-aaaaf-anl2a-cai", 4)]
    #[test_case("7msbr-laaaa-aaaaf-ayvuq-cai", 4)]
    #[test_case("4tp53-zyaaa-aaaaf-ahuka-cai", 4)]
    #[test_case("2rfpz-oqaaa-aaaaf-altqq-cai", 4)]
    #[test_case("nfjlt-kaaaa-aaaar-axpxq-cai", 5)]
    #[test_case("jbnqx-jiaaa-aaaar-axqjq-cai", 5)]
    #[test_case("spy3n-6aaaa-aaaar-ahdua-cai", 5)]
    #[test_case("pv6ta-6iaaa-aaaar-amzma-cai", 5)]
    #[test_case("7f2z4-ayaaa-aaaar-atdna-cai", 5)]
    #[test_case("ymql4-jaaaa-aaaar-ahrgq-cai", 5)]
    #[test_case("ueepn-qiaaa-aaaar-ampla-cai", 5)]
    #[test_case("66227-4aaaa-aaaar-aoeyq-cai", 5)]
    #[test_case("dgegb-daaaa-aaaar-arlhq-cai", 5)]
    #[test_case("zzyk3-openc-hatbo-tq7my-cai", 10)]
    #[test_case("tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae", 30)]
    #[test_case("aaaaa-aa", 1)]
    fn roundtrip_from_str(s: &str, expected_length: usize) {
        roundtrip(CanisterId::from_text(s).unwrap(), expected_length);
    }

    #[test_case(&[0,0,0,0,0,1,1,1,1,1], 1)]
    #[test_case(&[1,0,0,0,0,1,1,1,1,1], 2)]
    #[test_case(&[1,2,0,0,0,1,1,1,1,1], 3)]
    #[test_case(&[1,1,1,1,0,0,0,0,1,1], 6)]
    #[test_case(&[1,1,1,1,0,0,0,0,1,2], 8)]
    #[test_case(&[1,0,1,1,1,1,1,1,1,1], 2)]
    #[test_case(&[1,0,0,1,1,1,1,1,1,2], 9)]
    #[test_case(&[], 1)]
    #[test_case(&[0], 2)]
    #[test_case(&[1], 2)]
    fn roundtrip_from_bytes(bytes: &[u8], expected_length: usize) {
        roundtrip(CanisterId::from_slice(bytes), expected_length);
    }

    fn roundtrip(input: CanisterId, expected_length: usize) {
        let internal = CanisterIdInternal::from(input);
        assert_eq!(internal.0.len(), expected_length);

        let output = CanisterId::from(internal);
        assert_eq!(input, output);
    }
}
