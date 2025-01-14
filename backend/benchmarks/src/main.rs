use types::CanisterId;

mod chat_events;

fn main() {}

fn canister_id_from_u64(input: u64) -> CanisterId {
    let mut bytes = [0u8, 0, 0, 0, 0, 0, 0, 0, 1, 1];
    bytes[..8].clone_from_slice(&input.to_be_bytes());
    CanisterId::from_slice(&bytes)
}
