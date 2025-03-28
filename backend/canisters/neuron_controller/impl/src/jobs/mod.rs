use crate::RuntimeState;

pub mod process_neurons;
mod refresh_8_year_neuron;

pub(crate) fn start(_state: &RuntimeState) {
    process_neurons::start_job();
    refresh_8_year_neuron::start_job();
}
