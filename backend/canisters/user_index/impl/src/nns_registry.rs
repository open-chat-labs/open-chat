use candid::Principal;
use canister_client::make_c2c_call_raw;
use std::collections::HashMap;
use types::{C2CError, CanisterId};

// rwlgt-iiaaa-aaaaa-aaaaa-cai
const NNS_REGISTRY_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);

// Which subnet each canister ID range is hosted on, as held by the IC registry canister under
// the "routing_table" key
pub struct RoutingTable {
    ranges: Vec<CanisterIdRange>,
}

struct CanisterIdRange {
    start: u64,
    end: u64,
    subnet_id: Principal,
}

impl RoutingTable {
    pub fn subnet_id(&self, canister_id: &CanisterId) -> Option<Principal> {
        let id = canister_id_to_u64(canister_id)?;
        self.ranges.iter().find(|r| r.start <= id && id <= r.end).map(|r| r.subnet_id)
    }

    // Groups the given canisters by which of the given canisters (typically the LocalUserIndexes)
    // are on the same subnet, returning those on a subnet with none of them separately
    pub fn group_by_subnet_of(
        &self,
        canister_ids: Vec<CanisterId>,
        peers: &[CanisterId],
    ) -> (HashMap<CanisterId, Vec<CanisterId>>, Vec<CanisterId>) {
        let subnet_to_peer: HashMap<Principal, CanisterId> =
            peers.iter().filter_map(|p| self.subnet_id(p).map(|s| (s, *p))).collect();

        let mut grouped: HashMap<CanisterId, Vec<CanisterId>> = HashMap::new();
        let mut ungrouped = Vec::new();
        for canister_id in canister_ids {
            match self.subnet_id(&canister_id).and_then(|s| subnet_to_peer.get(&s)) {
                Some(peer) => grouped.entry(*peer).or_default().push(canister_id),
                None => ungrouped.push(canister_id),
            }
        }
        (grouped, ungrouped)
    }
}

pub async fn routing_table() -> Result<RoutingTable, C2CError> {
    // RegistryGetValueRequest { key: bytes (field 2) }
    let key = b"routing_table";
    let mut request = vec![0x12, key.len() as u8];
    request.extend_from_slice(key);

    let response = make_c2c_call_raw(NNS_REGISTRY_CANISTER_ID, "get_value", &request, 0, None).await?;

    decode_routing_table(&response)
        .map(|ranges| RoutingTable { ranges })
        .ok_or_else(|| {
            C2CError::new(
                NNS_REGISTRY_CANISTER_ID,
                "get_value",
                RejectCode::CanisterError,
                "Failed to decode routing table".to_string(),
            )
        })
}

// Canister IDs are a u64 (big-endian) followed by the two tag bytes 0x01, 0x01
fn canister_id_to_u64(canister_id: &CanisterId) -> Option<u64> {
    let bytes = canister_id.as_slice();
    (bytes.len() == 10 && bytes[8..] == [1, 1]).then(|| u64::from_be_bytes(bytes[..8].try_into().unwrap()))
}

// The registry speaks protobuf. The handful of messages involved are simple enough to decode
// by hand, which saves pulling in the IC's protobuf crates:
//
// RegistryGetValueResponse { error: RegistryError (1), version: u64 (2), value: bytes (3) }
// RoutingTable { entries: repeated Entry (1) }
// Entry { range: CanisterIdRange (1), subnet_id: SubnetId (2) }
// CanisterIdRange { start_canister_id: CanisterId (3), end_canister_id: CanisterId (4) }
// CanisterId / SubnetId { principal_id: PrincipalId (1) }
// PrincipalId { raw: bytes (1) }
fn decode_routing_table(bytes: &[u8]) -> Option<Vec<CanisterIdRange>> {
    let response = fields(bytes)?;
    if response.iter().any(|(f, _)| *f == 1) {
        return None;
    }
    let table = fields(bytes_field(&response, 3)?)?;

    let mut ranges = Vec::new();
    for (field, value) in table {
        if field != 1 {
            continue;
        }
        let entry = fields(value.bytes()?)?;
        let range = fields(bytes_field(&entry, 1)?)?;
        let start = canister_id_to_u64(&principal(bytes_field(&range, 3)?)?)?;
        let end = canister_id_to_u64(&principal(bytes_field(&range, 4)?)?)?;
        let subnet_id = principal(bytes_field(&entry, 2)?)?;
        ranges.push(CanisterIdRange { start, end, subnet_id });
    }
    Some(ranges)
}

fn principal(bytes: &[u8]) -> Option<Principal> {
    let id = fields(bytes)?;
    let principal_id = fields(bytes_field(&id, 1)?)?;
    Principal::try_from_slice(bytes_field(&principal_id, 1)?).ok()
}

enum Value<'a> {
    Bytes(&'a [u8]),
    Skipped,
}

impl<'a> Value<'a> {
    fn bytes(&self) -> Option<&'a [u8]> {
        if let Value::Bytes(bytes) = self { Some(bytes) } else { None }
    }
}

fn bytes_field<'a>(fields: &[(u32, Value<'a>)], field: u32) -> Option<&'a [u8]> {
    fields.iter().find(|(f, _)| *f == field).and_then(|(_, v)| v.bytes())
}

fn fields(bytes: &[u8]) -> Option<Vec<(u32, Value<'_>)>> {
    let mut pos = 0;
    let mut result = Vec::new();
    while pos < bytes.len() {
        let tag = varint(bytes, &mut pos)?;
        let field = u32::try_from(tag >> 3).ok()?;
        let value = match tag & 7 {
            0 => {
                varint(bytes, &mut pos)?;
                Value::Skipped
            }
            1 => {
                pos += 8;
                Value::Skipped
            }
            2 => {
                let len = usize::try_from(varint(bytes, &mut pos)?).ok()?;
                let value = bytes.get(pos..pos.checked_add(len)?)?;
                pos += len;
                Value::Bytes(value)
            }
            5 => {
                pos += 4;
                Value::Skipped
            }
            _ => return None,
        };
        result.push((field, value));
    }
    Some(result)
}

fn varint(bytes: &[u8], pos: &mut usize) -> Option<u64> {
    let mut result = 0u64;
    let mut shift = 0;
    loop {
        let byte = *bytes.get(*pos)?;
        *pos += 1;
        result |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Some(result);
        }
        shift += 7;
        if shift > 63 {
            return None;
        }
    }
}

use ic_cdk::call::RejectCode;

#[cfg(test)]
mod tests {
    use super::*;

    fn len_delimited(field: u8, bytes: &[u8]) -> Vec<u8> {
        let mut result = vec![field << 3 | 2];
        let mut len = bytes.len();
        while len >= 0x80 {
            result.push((len as u8 & 0x7f) | 0x80);
            len >>= 7;
        }
        result.push(len as u8);
        result.extend_from_slice(bytes);
        result
    }

    fn principal_message(principal: &Principal) -> Vec<u8> {
        len_delimited(1, &len_delimited(1, principal.as_slice()))
    }

    fn canister_id(index: u64) -> CanisterId {
        let mut bytes = index.to_be_bytes().to_vec();
        bytes.extend_from_slice(&[1, 1]);
        Principal::from_slice(&bytes)
    }

    fn entry(start: u64, end: u64, subnet_id: &Principal) -> Vec<u8> {
        let mut range = len_delimited(3, &principal_message(&canister_id(start)));
        range.extend(len_delimited(4, &principal_message(&canister_id(end))));
        let mut entry = len_delimited(1, &range);
        entry.extend(len_delimited(2, &principal_message(subnet_id)));
        len_delimited(1, &entry)
    }

    #[test]
    fn decodes_routing_table_and_groups_by_subnet() {
        let subnet_a = Principal::from_slice(&[1; 29]);
        let subnet_b = Principal::from_slice(&[2; 29]);
        let mut table = entry(100, 199, &subnet_a);
        table.extend(entry(200, 299, &subnet_b));
        table.extend(entry(300, 399, &subnet_a));

        let mut response = vec![2 << 3, 42]; // version
        response.extend(len_delimited(3, &table));

        let routing_table = RoutingTable {
            ranges: decode_routing_table(&response).unwrap(),
        };
        assert_eq!(routing_table.ranges.len(), 3);
        assert_eq!(routing_table.subnet_id(&canister_id(150)), Some(subnet_a));
        assert_eq!(routing_table.subnet_id(&canister_id(200)), Some(subnet_b));
        assert_eq!(routing_table.subnet_id(&canister_id(399)), Some(subnet_a));
        assert_eq!(routing_table.subnet_id(&canister_id(400)), None);
        assert_eq!(routing_table.subnet_id(&Principal::anonymous()), None);

        let lui_a = canister_id(101);
        let lui_b = canister_id(201);
        let (grouped, ungrouped) = routing_table.group_by_subnet_of(
            vec![canister_id(150), canister_id(250), canister_id(350), canister_id(500)],
            &[lui_a, lui_b],
        );
        assert_eq!(grouped[&lui_a], vec![canister_id(150), canister_id(350)]);
        assert_eq!(grouped[&lui_b], vec![canister_id(250)]);
        assert_eq!(ungrouped, vec![canister_id(500)]);
    }

    #[test]
    fn error_response_is_rejected() {
        let response = len_delimited(1, &[8, 1]); // error { code: 1 }
        assert!(decode_routing_table(&response).is_none());
    }
}
