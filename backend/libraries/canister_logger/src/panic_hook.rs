use std::panic;

pub fn set_panic_hook() {
    panic::set_hook(Box::new(|info| {
        let file = info.location().unwrap().file();
        let line = info.location().unwrap().line();
        let column = info.location().unwrap().column();

        let error_message = match info.payload().downcast_ref::<&'static str>() {
            Some(s) => *s,
            None => match info.payload().downcast_ref::<String>() {
                Some(s) => &s[..],
                None => "Box<Any>",
            },
        };

        let err_info = format!("Panicked at '{error_message}', {file}:{line}:{column}");
        ic_cdk::print(&err_info);
        ic_cdk::trap(&err_info);
    }));
}
