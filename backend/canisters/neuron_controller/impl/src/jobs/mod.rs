use crate::RuntimeState;

pub mod process_neurons;
mod refresh_8_year_neuron;
mod refresh_voting_power;

pub(crate) fn start(_state: &RuntimeState) {
    process_neurons::start_job();
    refresh_8_year_neuron::start_job();
    refresh_voting_power::start_job();
}
