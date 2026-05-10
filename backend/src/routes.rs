use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use aws_sdk_s3::presigning::PresigningConfig;
use livekit_api::access_token::{AccessToken, VideoGrants};
use rand::{distr::Alphanumeric, Rng};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/rooms", post(create_room))
        .route("/rooms/{token}", get(check_room))
        .route("/rooms/{token}/join", post(join_room))
        .route("/files/upload-url", post(create_upload_url))
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "meet37-backend",
    })
}

#[derive(Serialize)]
struct CreateRoomResponse {
    token: String,
}

#[derive(Serialize)]
struct RoomExistsResponse {
    exists: bool,
}

#[derive(Deserialize)]
struct JoinRoomRequest {
    #[serde(rename = "displayName")]
    display_name: String,
}

#[derive(Serialize)]
struct JoinRoomResponse {
    #[serde(rename = "livekitToken")]
    livekit_token: String,
}

#[derive(Deserialize)]
struct UploadUrlRequest {
    filename: String,
    size: i64,
}

#[derive(Serialize)]
struct UploadUrlResponse {
    #[serde(rename = "fileId")]
    file_id: String,
    #[serde(rename = "uploadUrl")]
    upload_url: String,
    #[serde(rename = "downloadUrl")]
    download_url: String,
}

async fn create_room(
    State(state): State<AppState>,
) -> Result<(StatusCode, Json<CreateRoomResponse>), AppError> {
    for _ in 0..5 {
        let token = generate_room_token();
        let insert_result = sqlx::query("INSERT INTO rooms (token) VALUES ($1)")
            .bind(&token)
            .execute(&state.db_pool)
            .await;

        match insert_result {
            Ok(_) => {
                cache_room_existence(&state, &token).await;
                return Ok((StatusCode::CREATED, Json(CreateRoomResponse { token })));
            }
            Err(err) if is_unique_violation(&err) => continue,
            Err(err) => return Err(err.into()),
        }
    }

    Err(AppError::Internal)
}

async fn check_room(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<RoomExistsResponse>, AppError> {
    if room_exists(&state, &token).await? {
        return Ok(Json(RoomExistsResponse { exists: true }));
    }

    Err(AppError::NotFound(format!("room `{token}` was not found")))
}

async fn join_room(
    Path(token): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, AppError> {
    let display_name = payload.display_name.trim();
    if display_name.is_empty() {
        return Err(AppError::BadRequest(
            "`displayName` cannot be empty".to_owned(),
        ));
    }

    if display_name.chars().count() > 64 {
        return Err(AppError::BadRequest(
            "`displayName` must be 64 characters or less".to_owned(),
        ));
    }

    if !room_exists(&state, &token).await? {
        return Err(AppError::NotFound(format!("room `{token}` was not found")));
    }

    let grants = VideoGrants {
        room_join: true,
        room: token.to_lowercase(),
        can_publish: true,
        can_subscribe: true,
        can_publish_data: true,
        ..Default::default()
    };

    let identity = format!("participant-{}", Uuid::new_v4().simple());
    let livekit_token = AccessToken::with_api_key(
        &state.config.livekit_api_key,
        &state.config.livekit_api_secret,
    )
    .with_identity(&identity)
    .with_name(display_name)
    .with_grants(grants)
    .to_jwt()
    .map_err(|err| AppError::External(format!("failed to generate livekit token: {err}")))?;

    Ok(Json(JoinRoomResponse { livekit_token }))
}

async fn create_upload_url(
    State(state): State<AppState>,
    Json(payload): Json<UploadUrlRequest>,
) -> Result<Json<UploadUrlResponse>, AppError> {
    if payload.size <= 0 {
        return Err(AppError::BadRequest("`size` must be a positive number".to_owned()));
    }

    let file_id = Uuid::new_v4().to_string();
    let clean_filename = sanitize_filename(&payload.filename);
    let object_key = format!("uploads/{file_id}-{clean_filename}");

    let upload_presign = PresigningConfig::expires_in(Duration::from_secs(300))
        .map_err(|err| AppError::External(format!("failed to prepare upload presign: {err}")))?;
    let upload_request = state
        .s3_client
        .put_object()
        .bucket(&state.config.s3_bucket)
        .key(&object_key)
        .content_length(payload.size)
        .presigned(upload_presign)
        .await
        .map_err(|err| AppError::External(format!("failed to create upload URL: {err}")))?;

    let download_presign = PresigningConfig::expires_in(Duration::from_secs(3600))
        .map_err(|err| AppError::External(format!("failed to prepare download presign: {err}")))?;
    let download_request = state
        .s3_client
        .get_object()
        .bucket(&state.config.s3_bucket)
        .key(&object_key)
        .presigned(download_presign)
        .await
        .map_err(|err| AppError::External(format!("failed to create download URL: {err}")))?;

    let upload_url = to_public_s3_url(
        upload_request.uri().to_string(),
        &state.config.s3_public_base_url,
    )?;
    let download_url = to_public_s3_url(
        download_request.uri().to_string(),
        &state.config.s3_public_base_url,
    )?;

    Ok(Json(UploadUrlResponse {
        file_id,
        upload_url,
        download_url,
    }))
}

async fn room_exists(state: &AppState, token: &str) -> Result<bool, AppError> {
    let normalized = token.to_lowercase();
    if is_room_cached(state, &normalized).await {
        return Ok(true);
    }

    let exists = sqlx::query("SELECT 1 FROM rooms WHERE lower(token) = lower($1)")
        .bind(&normalized)
        .fetch_optional(&state.db_pool)
        .await?
        .is_some();

    if exists {
        cache_room_existence(state, &normalized).await;
    }

    Ok(exists)
}

fn generate_room_token() -> String {
    rand::rng()
        .sample_iter(Alphanumeric)
        .take(12)
        .map(char::from)
        .map(|ch| ch.to_ascii_lowercase())
        .collect()
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    match err {
        sqlx::Error::Database(database_err) => database_err.code().as_deref() == Some("23505"),
        _ => false,
    }
}

async fn is_room_cached(state: &AppState, token: &str) -> bool {
    let key = room_cache_key(token);
    let Ok(mut conn) = state.redis_client.get_multiplexed_async_connection().await else {
        return false;
    };

    let cached: Result<Option<String>, redis::RedisError> = conn.get(&key).await;
    cached.map(|value| value.is_some()).unwrap_or(false)
}

async fn cache_room_existence(state: &AppState, token: &str) {
    let key = room_cache_key(token);
    let Ok(mut conn) = state.redis_client.get_multiplexed_async_connection().await else {
        return;
    };

    let _: Result<(), redis::RedisError> = conn.set_ex(&key, "1", 3600).await;
}

fn room_cache_key(token: &str) -> String {
    format!("room:exists:{token}")
}

fn to_public_s3_url(raw_url: String, public_base_url: &Option<String>) -> Result<String, AppError> {
    let Some(base_url) = public_base_url.as_deref() else {
        return Ok(raw_url);
    };

    let mut source =
        Url::parse(&raw_url).map_err(|err| AppError::External(format!("invalid presigned URL: {err}")))?;
    let target =
        Url::parse(base_url).map_err(|err| AppError::Config(format!("invalid S3_PUBLIC_BASE_URL: {err}")))?;

    source
        .set_scheme(target.scheme())
        .map_err(|_| AppError::Config("invalid scheme in S3_PUBLIC_BASE_URL".to_owned()))?;
    source
        .set_host(target.host_str())
        .map_err(|_| AppError::Config("invalid host in S3_PUBLIC_BASE_URL".to_owned()))?;
    source.set_port(target.port()).map_err(|_| {
        AppError::Config("invalid port in S3_PUBLIC_BASE_URL".to_owned())
    })?;

    Ok(source.to_string())
}

fn sanitize_filename(filename: &str) -> String {
    let sanitized: String = filename
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch
            } else {
                '_'
            }
        })
        .collect();

    if sanitized.trim_matches('_').is_empty() {
        "file.bin".to_owned()
    } else {
        sanitized
    }
}
