use crate::TestEnv;
use crate::setup::setup_new_env;
use crate::utils::now_nanos;
use candid::Principal;
use lazy_static::lazy_static;
use std::ops::Deref;
use std::sync::Mutex;
use std::time::Duration;
use types::{Hash, TimestampNanos};

lazy_static! {
    pub static ref ENV: TestEnvManager = TestEnvManager::default();
}

pub const VIDEO_CALL_OPERATOR: Principal = Principal::from_slice(&[1, 2, 3, 4, 5]);

// An env whose clock has moved on further than this since it was created isn't returned to the
// pool (see `Drop`). This catches tests which jump hours or days, leaving the canisters' interval
// jobs (which run hourly or less often) to catch up during whichever test draws the env next. A
// test whose shorter steps would still affect the next test should call `discard`.
const MAX_CLOCK_ADVANCE: Duration = Duration::from_secs(60 * 60);

#[derive(Default)]
pub struct TestEnvManager {
    // Each env with the time on its clock when it was created
    envs: Mutex<Vec<(TestEnv, TimestampNanos)>>,
}

impl TestEnvManager {
    pub fn get(&self) -> TestEnvWrapper {
        let pooled = self.envs.lock().unwrap().pop();
        if let Some((env, created_at)) = pooled {
            TestEnvWrapper {
                env: Some(env),
                created_at,
            }
        } else {
            self.create_new()
        }
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
    created_at: TimestampNanos,
}

impl TestEnvWrapper {
    pub fn new(env: TestEnv) -> Self {
        let created_at = now_nanos(&env.env);
        Self {
            env: Some(env),
            created_at,
        }
    }

    pub fn env(&mut self) -> &mut TestEnv {
        self.env.as_mut().unwrap()
    }

    // Drops the env instead of returning it to the pool. Tests which change env-wide state (e.g.
    // release a new wasm) MUST call this: a pooled env left changed poisons whichever test draws
    // it next, which surfaces as unrelated flakes. An env whose clock has moved on more than
    // `MAX_CLOCK_ADVANCE`, or whose test panics, is never returned to the pool (see `Drop`), so
    // this is only needed for other changes, on the path where the test passes.
    pub fn discard(mut self) {
        self.env = None;
        std::mem::forget(self);
    }

    fn clock_advance(&self, env: &TestEnv) -> Duration {
        Duration::from_nanos(now_nanos(&env.env).saturating_sub(self.created_at))
    }
}

impl Drop for TestEnvWrapper {
    fn drop(&mut self) {
        let env = std::mem::take(&mut self.env).unwrap();
        // A failing test may have left the env half-changed (e.g. before reaching its `discard`),
        // and an env whose clock has been pushed well forward leaves pending timers to fire and
        // time-based state to reconcile in the next test, so drop either rather than hand it to
        // whichever test draws it next
        if !std::thread::panicking() && self.clock_advance(&env) <= MAX_CLOCK_ADVANCE {
            ENV.deref().envs.lock().unwrap().push((env, self.created_at));
        }
    }
}
