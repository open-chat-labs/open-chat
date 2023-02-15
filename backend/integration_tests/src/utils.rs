use candid::Principal;
use ic_state_machine_tests::StateMachine;
use serde::Serialize;

pub fn principal_to_username(principal: Principal) -> String {
    principal.to_string()[0..5].to_string()
}

pub fn assert_json_eq<T: Serialize>(left: T, right: T) {
    assert_eq!(serde_json::to_string(&left).unwrap(), serde_json::to_string(&right).unwrap());
}

pub fn tick_many(env: &mut StateMachine, count: usize) {
    for _ in 0..count {
        env.tick();
    }
}
