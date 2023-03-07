use candid::Principal;
use ic_state_machine_tests::StateMachine;
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
    env.time().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_millis() as u64
}
