pub fn timestamp_seconds() -> u64 {
    timestamp_nanos() / 1_000_000_000
}

pub fn timestamp_millis() -> u64 {
    timestamp_nanos() / 1_000_000
}

pub fn timestamp_micros() -> u64 {
    timestamp_nanos() / 1_000
}

#[cfg(target_arch = "wasm32")]
pub fn timestamp_nanos() -> u64 {
    unsafe { ic0::time() as u64 }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn timestamp_nanos() -> u64 {
    use std::time::SystemTime;

    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64
}
