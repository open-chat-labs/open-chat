pub fn now_seconds() -> u64 {
    now_nanos() / 1_000_000_000
}

pub fn now_millis() -> u64 {
    now_nanos() / 1_000_000
}

pub fn now_micros() -> u64 {
    now_nanos() / 1_000
}

#[cfg(target_arch = "wasm32")]
pub fn now_nanos() -> u64 {
    unsafe { ic0::time() as u64 }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn now_nanos() -> u64 {
    use std::time::SystemTime;

    SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos() as u64
}
