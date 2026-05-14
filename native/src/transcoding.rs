use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;

#[napi]
pub fn generate_thumbnail(
    path: String,
    time_seconds: f64,
    output_path: String,
) -> Result<(), napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let stream = context
        .streams()
        .best(ffmpeg::media::Type::Video)
        .ok_or_else(|| napi::Error::from_reason("No video stream found"))?;

    let stream_index = stream.index();
    let context_parameters = stream.parameters();
    let mut decoder = ffmpeg::codec::context::Context::from_parameters(context_parameters)
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .video()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get video decoder: {}", e)))?;

    let position = (time_seconds * ffmpeg::ffi::AV_TIME_BASE as f64) as i64;
    context
        .seek(position, ..position)
        .map_err(|e| napi::Error::from_reason(format!("Seek error: {}", e)))?;

    let mut scaler = ffmpeg::software::scaling::context::Context::get(
        decoder.format(),
        decoder.width(),
        decoder.height(),
        ffmpeg::util::format::Pixel::RGB24,
        decoder.width(),
        decoder.height(),
        ffmpeg::software::scaling::flag::Flags::BILINEAR,
    )
    .map_err(|e| napi::Error::from_reason(format!("Scaler error: {}", e)))?;

    let mut frame_decoded = ffmpeg::util::frame::Video::empty();
    let mut thumbnail_generated = false;

    'outer: for (stream, packet) in context.packets() {
        if stream.index() != stream_index {
            continue;
        }
        if decoder.send_packet(&packet).is_err() {
            continue;
        }
        while decoder.receive_frame(&mut frame_decoded).is_ok() {
            let mut frame_rgb = ffmpeg::util::frame::Video::empty();
            scaler
                .run(&frame_decoded, &mut frame_rgb)
                .map_err(|e| napi::Error::from_reason(format!("Scaling error: {}", e)))?;

            // Encode to MJPEG via FFmpeg
            let codec = ffmpeg::encoder::find(ffmpeg::codec::Id::MJPEG)
                .ok_or_else(|| napi::Error::from_reason("MJPEG encoder not found"))?;

            let encoder_ctx = ffmpeg::codec::context::Context::new();
            let mut enc = encoder_ctx
                .encoder()
                .video()
                .map_err(|_| napi::Error::from_reason("Failed to get video encoder"))?;

            enc.set_width(decoder.width());
            enc.set_height(decoder.height());
            enc.set_format(ffmpeg::util::format::Pixel::YUVJ420P);
            enc.set_time_base(ffmpeg_next::Rational(1, 25));

            let mut enc = enc
                .open_as(codec)
                .map_err(|e| napi::Error::from_reason(format!("Failed to open encoder: {}", e)))?;

            let mut sws = ffmpeg::software::scaling::context::Context::get(
                ffmpeg::util::format::Pixel::RGB24,
                decoder.width(),
                decoder.height(),
                ffmpeg::util::format::Pixel::YUVJ420P,
                decoder.width(),
                decoder.height(),
                ffmpeg::software::scaling::flag::Flags::BILINEAR,
            )
            .map_err(|e| napi::Error::from_reason(format!("Scaler error: {}", e)))?;

            let mut frame_j = ffmpeg::util::frame::Video::empty();
            sws.run(&frame_rgb, &mut frame_j)
                .map_err(|e| napi::Error::from_reason(format!("Scaling error: {}", e)))?;

            let mut pkt = ffmpeg::Packet::empty();
            if enc.send_frame(&frame_j).is_ok() && enc.receive_packet(&mut pkt).is_ok() {
                if let Some(data) = pkt.data() {
                    std::fs::write(&output_path, data).map_err(|e| {
                        napi::Error::from_reason(format!("Failed to write file: {}", e))
                    })?;
                    thumbnail_generated = true;
                    break 'outer;
                }
            }
        }
    }

    if !thumbnail_generated {
        return Err(napi::Error::from_reason("Failed to generate thumbnail"));
    }
    Ok(())
}
