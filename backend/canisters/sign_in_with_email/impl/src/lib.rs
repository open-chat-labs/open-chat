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
    params
        .iter()
        .find(|(k, _)| *k == key)
        .map(|(_, v)| v.to_string())
}

#[cfg(test)]
mod generate_candid_file {
    use ic_cdk::export_candid;
    use ic_http_certification::*;
    use sign_in_with_email_canister::*;
    use std::env;
    use std::fs::write;
    use std::path::PathBuf;

    #[test]
    fn save_candid() {
        let dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
        let dir = dir.parent().unwrap().join("api");

        export_candid!();
        write(dir.join("can.did"), __export_service()).unwrap()
    }
}
