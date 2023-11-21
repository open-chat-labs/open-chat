use crate::RuntimeState;

pub mod refresh_neurons;

pub(crate) fn start(_state: &RuntimeState) {
    refresh_neurons::start_job();
}
