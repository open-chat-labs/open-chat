use crate::TestEnv;
use crate::setup::setup_new_env;
use candid::Principal;
use lazy_static::lazy_static;
use std::ops::Deref;
use std::sync::Mutex;
use types::Hash;

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
        // Release the lock before creating a new env. The base state is still only built once
        // (see `setup_new_env`), creating envs from it in parallel is quicker than one at a time,
        // and a panic while creating one no longer poisons the pool for every later test.
        let env = self.envs.lock().unwrap().pop();
        if let Some(env) = env { TestEnvWrapper::new(env) } else { self.create_new() }
    }

    pub fn create_new(&self) -> TestEnvWrapper {
        TestEnvWrapper::new(setup_new_env(None))
    }

    pub fn get_with_seed(&self, seed: Hash) -> TestEnvWrapper {
        TestEnvWrapper::new(setup_new_env(Some(seed)))
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

    // Drops the env instead of returning it to the pool. Tests which advance time
    // significantly or change env-wide state (e.g. release a new wasm) MUST call this: a pooled
    // env with its clock pushed forward poisons whichever test draws it next (pending timers
    // fire, time-based state reconciles), which surfaces as unrelated flakes. A test which
    // panics never returns its env to the pool (see `Drop`), so this is only needed on the path
    // where the test passes.
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
