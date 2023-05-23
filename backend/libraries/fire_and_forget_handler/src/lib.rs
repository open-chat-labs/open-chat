use canister_client::make_c2c_call_raw;
use ic_cdk_timers::TimerId;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::{BTreeMap, HashMap};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, TimestampMillis};
use utils::time::{now_millis, SECOND_IN_MS};

fn start_job(wrapper: Arc<Mutex<FireAndForgetHandlerInner>>) {
    let clone = wrapper.clone();
    let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, move || run(&clone));
    wrapper.lock().unwrap().timer_id = Some(timer_id);
    trace!("FireAndForgetHandler job started");
}

fn run(wrapper: &Arc<Mutex<FireAndForgetHandlerInner>>) {
    let now = now_millis();
    // This line must remain separate from the match statement so that the MutexGuard is dropped
    let next_batch = wrapper.lock().unwrap().next_batch(50, now);
    match next_batch {
        NextBatchResult::Success(batch) => ic_cdk::spawn(process_batch(batch, wrapper.clone())),
        NextBatchResult::Continue => {}
        NextBatchResult::StopJob => {
            if let Some(timer_id) = wrapper.lock().unwrap().timer_id.take() {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("FireAndForgetHandler job stopped");
            }
        }
    }
}

async fn process_batch(batch: Vec<C2cCall>, wrapper: Arc<Mutex<FireAndForgetHandlerInner>>) {
    futures::future::join_all(batch.into_iter().map(|c| process_single(c, wrapper.clone()))).await;
}

async fn process_single(mut call: C2cCall, wrapper: Arc<Mutex<FireAndForgetHandlerInner>>) {
    let result = make_c2c_call_raw(call.canister_id, &call.method_name, &call.payload).await;

    let mut should_start_job = false;
    if result.is_err() || call.attempt > 0 {
        let handler = &mut wrapper.lock().unwrap();
        let calls = handler.canisters.entry(call.canister_id).or_default();
        calls.in_progress.retain(|id| *id != call.id);

        if result.is_err() && call.attempt < 50 {
            call.attempt += 1;
            let now = now_millis();
            let due = now + (u64::from(call.attempt) * SECOND_IN_MS);
            calls.queue.insert((due, call.id), call);
            should_start_job = handler.should_start_job();
        } else if calls.in_progress.is_empty() && calls.queue.is_empty() {
            handler.canisters.remove(&call.canister_id);
        }
    }

    if should_start_job {
        start_job(wrapper.clone());
    }
}

pub struct FireAndForgetHandler {
    inner: Arc<Mutex<FireAndForgetHandlerInner>>,
}

impl Default for FireAndForgetHandler {
    fn default() -> Self {
        FireAndForgetHandler::init(FireAndForgetHandlerInner::default())
    }
}

impl FireAndForgetHandler {
    pub fn send(&self, canister_id: CanisterId, method_name: String, payload: Vec<u8>) {
        let mut handler = self.inner.lock().unwrap();
        let id = handler.next_id;
        handler.next_id += 1;

        let call = C2cCall {
            id,
            canister_id,
            method_name,
            payload,
            attempt: 0,
        };

        ic_cdk::spawn(process_single(call, self.inner.clone()));
    }

    fn init(inner: FireAndForgetHandlerInner) -> Self {
        let should_start_job = inner.should_start_job();
        let wrapped = Arc::new(Mutex::new(inner));

        if should_start_job {
            start_job(wrapped.clone());
        }

        FireAndForgetHandler { inner: wrapped }
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
    payload: Vec<u8>,
    attempt: u32,
}

impl Serialize for FireAndForgetHandler {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.inner.lock().unwrap().serialize(serializer)
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
