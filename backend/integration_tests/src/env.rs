use crate::setup::setup_new_env;
use crate::TestEnv;
use lazy_static::lazy_static;
use std::ops::Deref;
use std::sync::Mutex;
use types::Hash;

lazy_static! {
    pub static ref ENV: TestEnvManager = TestEnvManager::default();
}

#[derive(Default)]
pub struct TestEnvManager {
    envs: Mutex<Vec<TestEnv>>,
}

impl TestEnvManager {
    pub fn get(&self) -> TestEnvWrapper {
        self.get_internal(None)
    }

    pub fn get_with_seed(&self, seed: Hash) -> TestEnvWrapper {
        self.get_internal(Some(seed))
    }

    fn get_internal(&self, seed: Option<Hash>) -> TestEnvWrapper {
        let mut lock = self.envs.lock().unwrap();
        if let Some(env) = lock.pop() {
            TestEnvWrapper::new(env)
        } else {
            TestEnvWrapper::new(setup_new_env(seed))
        }
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
}

impl Drop for TestEnvWrapper {
    fn drop(&mut self) {
        let env = std::mem::take(&mut self.env).unwrap();
        ENV.deref().envs.lock().unwrap().push(env);
    }
}
