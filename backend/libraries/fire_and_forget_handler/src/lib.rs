use candid::CandidType;
use canister_client::make_c2c_call_raw;
use constants::SECOND_IN_MS;
use ic_cdk_timers::TimerId;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::{BTreeMap, HashMap};
use std::ops::DerefMut;
use std::rc::Rc;
use std::sync::Mutex;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, TimestampMillis};
use utils::canister::should_retry_failed_c2c_call;

pub struct FireAndForgetHandler {
    inner: Rc<Mutex<FireAndForgetHandlerInner>>,
}

impl FireAndForgetHandler {
    pub fn send(&self, canister_id: CanisterId, method_name: impl Into<String>, payload: Vec<u8>) {
        let id = self.within_lock(|i| {
            let id = i.next_id;
            i.next_id += 1;
            id
        });

        let call = C2cCall {
            id,
            canister_id,
            method_name: method_name.into(),
            payload,
            attempt: 0,
        };

        ic_cdk::spawn(self.clone().process_single(call));
    }

    pub fn send_candid<A: CandidType>(&self, canister_id: CanisterId, method_name: impl Into<String>, args: A) {
        self.send(canister_id, method_name, candid::encode_one(args).unwrap());
    }

    fn init(inner: FireAndForgetHandlerInner) -> Self {
        let wrapped = Rc::new(Mutex::new(inner));
        let handler = FireAndForgetHandler { inner: wrapped };
        handler.start_job_if_required();
        handler
    }

    async fn process_single(self, mut call: C2cCall) {
        let result = make_c2c_call_raw(call.canister_id, &call.method_name, &call.payload, 0).await;

        if result.is_err() || call.attempt > 0 {
            self.within_lock(|i| {
                let calls = i.canisters.entry(call.canister_id).or_default();
                calls.in_progress.retain(|id| *id != call.id);

                match result {
                    Err((code, msg)) if should_retry_failed_c2c_call(code, &msg) && call.attempt < 50 => {
                        call.attempt += 1;
                        let now = canister_time::now_millis();
                        let due = now + (u64::from(call.attempt) * SECOND_IN_MS);
                        calls.queue.insert((due, call.id), call);
                    }
                    _ => {
                        if calls.in_progress.is_empty() && calls.queue.is_empty() {
                            i.canisters.remove(&call.canister_id);
                        }
                    }
                }
            });
        }

        self.start_job_if_required();
    }

    async fn process_batch(self, batch: Vec<C2cCall>) {
        futures::future::join_all(batch.into_iter().map(|c| self.clone().process_single(c))).await;
    }

    fn start_job_if_required(&self) {
        if self.within_lock(|i| i.should_start_job()) {
            let clone = self.clone();
            let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, move || clone.run());
            self.within_lock(|i| i.timer_id = Some(timer_id));
            trace!("FireAndForgetHandler job started");
        }
    }

    fn run(&self) {
        let now = canister_time::now_millis();
        let next_batch = self.within_lock(|i| i.next_batch(50, now));
        match next_batch {
            NextBatchResult::Success(batch) => ic_cdk::spawn(self.clone().process_batch(batch)),
            NextBatchResult::Continue => {}
            NextBatchResult::StopJob => {
                if let Some(timer_id) = self.within_lock(|i| i.timer_id.take()) {
                    ic_cdk_timers::clear_timer(timer_id);
                    trace!("FireAndForgetHandler job stopped");
                }
            }
        }
    }

    fn within_lock<F: FnOnce(&mut FireAndForgetHandlerInner) -> T, T>(&self, f: F) -> T {
        let mut inner = self.inner.lock().unwrap();
        f(inner.deref_mut())
    }
}

#[derive(Serialize, Deserialize, Default)]
struct FireAndForgetHandlerInner {
    canisters: HashMap<CanisterId, PendingC2cCalls>,
    next_id: u64,
    #[serde(skip)]
    timer_id: Option<TimerId>,
}

enum NextBatchResult {
    Success(Vec<C2cCall>),
    Continue,
    StopJob,
}

impl FireAndForgetHandlerInner {
    fn next_batch(&mut self, max_count: u32, now: TimestampMillis) -> NextBatchResult {
        if self.canisters.is_empty() {
            NextBatchResult::StopJob
        } else {
            let mut results = Vec::new();
            for calls in self.canisters.values_mut().filter(|c| c.in_progress.is_empty()) {
                while calls.queue.first_key_value().map_or(false, |((ts, _), _)| *ts <= now) {
                    results.push(calls.queue.pop_first().unwrap().1);
                    if results.len() as u32 == max_count {
                        break;
                    }
                }
            }

            if results.is_empty() {
                NextBatchResult::Continue
            } else {
                for call in results.iter() {
                    let calls = self.canisters.get_mut(&call.canister_id).unwrap();
                    calls.in_progress.push(call.id);
                }

                NextBatchResult::Success(results)
            }
        }
    }

    fn should_start_job(&self) -> bool {
        self.timer_id.is_none() && !self.canisters.is_empty()
    }
}

#[derive(Serialize, Deserialize, Default)]
struct PendingC2cCalls {
    in_progress: Vec<u64>,
    queue: BTreeMap<(TimestampMillis, u64), C2cCall>,
}

#[derive(Serialize, Deserialize, Clone)]
struct C2cCall {
    id: u64,
    canister_id: CanisterId,
    method_name: String,
    #[serde(with = "serde_bytes")]
    payload: Vec<u8>,
    attempt: u32,
}

impl Clone for FireAndForgetHandler {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
        }
    }
}

impl Default for FireAndForgetHandler {
    fn default() -> Self {
        FireAndForgetHandler::init(FireAndForgetHandlerInner::default())
    }
}

impl Serialize for FireAndForgetHandler {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.within_lock(|i| i.serialize(serializer))
    }
}

impl<'de> Deserialize<'de> for FireAndForgetHandler {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let inner = FireAndForgetHandlerInner::deserialize(deserializer)?;
        Ok(FireAndForgetHandler::init(inner))
    }
}
