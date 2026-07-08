use crate::pseudo_random_bytes;
use canbench_rs::{BenchResult, bench, bench_fn};

// Decode cost of one uploaded frame (upload cap is 960px longest edge, quality 0.85).
// The JPEG is synthesized in setup (not measured) so no image asset needs committing.

fn synth_jpeg(width: u16, height: u16) -> Vec<u8> {
    let noise = pseudo_random_bytes(7, width as usize * height as usize * 3);
    let mut out = Vec::new();
    let encoder = jpeg_encoder::Encoder::new(&mut out, 85);
    encoder.encode(&noise, width, height, jpeg_encoder::ColorType::Rgb).unwrap();
    out
}

#[bench(raw)]
fn jpeg_decode_960x720() -> BenchResult {
    let jpeg = synth_jpeg(960, 720);
    bench_fn(|| {
        let mut decoder = zune_jpeg::JpegDecoder::new(&jpeg);
        std::hint::black_box(decoder.decode().unwrap());
    })
}
