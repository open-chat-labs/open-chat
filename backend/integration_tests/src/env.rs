use crate::TestEnv;
use crate::setup::setup_new_env;
use candid::Principal;
use lazy_static::lazy_static;
use std::ops::Deref;
use std::sync::Mutex;

lazy_static! {
    pub static ref ENV: TestEnvManager = TestEnvManager::default();
}

pub const VIDEO_CALL_OPERATOR: Principal = Principal::from_slice(&[1, 2, 3, 4, 5]);

#[derive(Default)]
pub struct TestEnvManager {
    envs: Mutex<Vec<TestEnv>>,
}

impl TestEnvManager {
    pub fn get(&self) -> TestEnvWrapper {
        let env = self.envs.lock().unwrap().pop();
        if let Some(env) = env { TestEnvWrapper::new(env) } else { self.create_new() }
    }

    pub fn create_new(&self) -> TestEnvWrapper {
        TestEnvWrapper::new(setup_new_env())
    }
}

pub struct TestEnvWrapper {
    env: Option<TestEnv>,
}

impl TestEnvWrapper {
    pub fn new(env: TestEnv) -> Self {
        Self { env: Some(env) }
    }

    pub fn env(&mut self) -> &mut TestEnv {
        self.env.as_mut().unwrap()
    }

    // Drops the env instead of returning it to the pool. Tests which change env-wide state (e.g.
    // release a new wasm) MUST call this: a pooled env left changed poisons whichever test draws
    // it next, which surfaces as unrelated flakes. A test which panics never returns its env to
    // the pool (see `Drop`), so this is only needed on the path where the test passes.
    //
    // Moving the clock forward by hours or days doesn't need it. The first test to use a new env
    // takes around 40s longer, and dropping every env whose clock had moved on by more than an
    // hour doubled the time the whole suite takes. A jump of months or years still does, since it
    // can drain canisters of their cycles (see `initialize_base_state`).
    pub fn discard(mut self) {
        self.env = None;
        std::mem::forget(self);
    }
}

impl Drop for TestEnvWrapper {
    fn drop(&mut self) {
        let env = std::mem::take(&mut self.env).unwrap();
        // A failing test may have left the env half-changed (e.g. before reaching its
        // `discard`), so drop it rather than hand it to whichever test draws it next
        if !std::thread::panicking() {
            ENV.deref().envs.lock().unwrap().push(env);
        }
    }
}
