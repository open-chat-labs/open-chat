// https://stackoverflow.com/questions/59506403/how-to-format-a-float-without-trailing-zeros-in-rust
pub fn format_to_decimal_places(number: f64, decimal_places: u8) -> String {
    let factor = 10f64.powf(decimal_places as f64);
    let result = (number * factor).round() / factor;
    result.to_string()
}
