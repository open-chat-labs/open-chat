use querystring::QueryParams;

mod email_sender;
mod env;
mod guards;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod rng;
mod state;
mod updates;

type Hash = [u8; 32];

fn get_query_param_value(params: &QueryParams, key: &str) -> Option<String> {
    params.iter().find(|(k, _)| *k == key).map(|(_, v)| v.to_string())
}
