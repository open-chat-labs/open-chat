use crate::RuntimeState;

pub mod process_neurons;

pub(crate) fn start(_state: &RuntimeState) {
    process_neurons::start_job();
}
