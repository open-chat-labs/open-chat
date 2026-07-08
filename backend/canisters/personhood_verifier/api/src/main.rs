use std::env;
use ts_export::generate_ts_method;

fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/personhoodVerifier");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(personhood_verifier, model_info);
    generate_ts_method!(personhood_verifier, start_verification);
    generate_ts_method!(personhood_verifier, submit_verification);
    generate_ts_method!(personhood_verifier, upload_frame);
    generate_ts_method!(personhood_verifier, verification_status);
}
