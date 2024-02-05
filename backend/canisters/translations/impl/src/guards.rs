use crate::read_state;

pub fn caller_is_deployment_operator() -> Result<(), String> {
    if read_state(|state| state.is_caller_deployment_operator()) {
        Ok(())
    } else {
        Err("Caller is not a deployment operator".to_string())
    }
}
