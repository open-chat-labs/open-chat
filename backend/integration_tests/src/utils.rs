use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::path::PathBuf;
use std::time::SystemTime;
use types::TimestampMillis;

pub fn principal_to_username(principal: Principal) -> String {
    principal.to_string()[0..5].to_string()
}

pub fn tick_many(env: &mut StateMachine, count: usize) {
    for _ in 0..count {
        env.tick();
    }
}

pub fn now_millis(env: &StateMachine) -> TimestampMillis {
    now_nanos(env) / 1_000_000
}

pub fn now_nanos(env: &StateMachine) -> TimestampMillis {
    env.time().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos() as u64
}

pub fn local_bin() -> PathBuf {
    let mut file_path =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("Failed to read CARGO_MANIFEST_DIR env variable"));
    file_path.push("local-bin");
    file_path
}
