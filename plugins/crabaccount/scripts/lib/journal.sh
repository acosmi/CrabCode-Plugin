#!/usr/bin/env bash

ca_prepare_preview() {
  local binding="$1"
  local canonical digest run_id pending pending_json
  canonical=$(jq -cS . <<<"$binding") || ca_die "VALIDATION_ERROR" "cannot canonicalize preview payload"
  digest=$(ca_sha256_text "$canonical") || ca_die "DEPENDENCY_MISSING" "SHA-256 implementation is unavailable"
  run_id="$(date -u '+%Y%m%dT%H%M%SZ')-${digest:0:12}"
  pending="$CA_PENDING_DIR/${digest}.json"
  pending_json=$(jq -cn --argjson binding "$canonical" --arg digest "$digest" --arg runId "$run_id" --arg createdAt "$(ca_now_utc)" \
    '{schemaVersion:1,runId:$runId,createdAt:$createdAt,previewDigest:$digest,binding:$binding}') \
    || ca_die "LOCAL_IO_ERROR" "cannot serialize pending preview"
  ca_atomic_write "$pending" 600 <<<"$pending_json"
  CA_PREVIEW_DIGEST="$digest"
  CA_RUN_ID="$run_id"
  CA_PENDING_FILE="$pending"
}

ca_validate_digest() {
  [[ "$1" =~ ^[a-f0-9]{64}$ ]]
}

ca_load_pending() {
  local digest="$1"
  local canonical recomputed
  ca_validate_digest "$digest" || ca_die "VALIDATION_ERROR" "digest must be a lowercase SHA-256 value"
  CA_PENDING_FILE="$CA_PENDING_DIR/${digest}.json"
  [[ -f "$CA_PENDING_FILE" ]] || ca_die "PREVIEW_NOT_FOUND" "no pending preview matches this digest" 3
  [[ ! -L "$CA_PENDING_FILE" ]] || ca_die "UNSAFE_PATH" "pending preview must not be a symbolic link"
  chmod 600 "$CA_PENDING_FILE" || ca_die "LOCAL_IO_ERROR" "cannot protect pending preview"
  jq -e --arg digest "$digest" '.schemaVersion == 1 and .previewDigest == $digest and (.binding|type=="object")' \
    "$CA_PENDING_FILE" >/dev/null 2>&1 || ca_die "PREVIEW_INVALID" "pending preview is malformed"
  canonical=$(jq -cS '.binding' "$CA_PENDING_FILE")
  recomputed=$(ca_sha256_text "$canonical")
  [[ "$recomputed" == "$digest" ]] || ca_die "DIGEST_MISMATCH" "pending preview content changed after confirmation" 3
  CA_PREVIEW_DIGEST="$digest"
  CA_RUN_ID=$(jq -r '.runId' "$CA_PENDING_FILE")
  CA_BINDING=$(jq -c '.binding' "$CA_PENDING_FILE")
}

ca_create_journal() {
  local journal="$CA_JOURNAL_DIR/${CA_RUN_ID}.json" journal_json
  [[ ! -e "$journal" ]] || ca_die "REPLAY_BLOCKED" "this preview has already been applied or attempted; create a new preview after reconciliation" 3
  journal_json=$(jq -cn \
    --arg runId "$CA_RUN_ID" \
    --arg confirmedAt "$(ca_now_utc)" \
    --arg apiBaseHash "$(ca_sha256_text "$CA_API_BASE")" \
    --arg previewDigest "$CA_PREVIEW_DIGEST" \
    --argjson binding "$CA_BINDING" \
    '{
      schemaVersion:1,
      runId:$runId,
      apiBaseHash:$apiBaseHash,
      inputSha256:($binding.inputSha256 // null),
      previewDigest:$previewDigest,
      canonicalSchemaVersion:($binding.schemaVersion // null),
      requestFingerprintVersion:"sha256-canonical-json-v1",
      confirmedAt:$confirmedAt,
      state:"running",
      rows:[
        $binding.operations[] |
        {
          index:.index,
          source:(.source // {}),
          requestFingerprint:.requestFingerprint,
          reconcile:{
            kind:(.kind // null),
            accountId:(.payload.accountId // null),
            accountToId:(.payload.accountToId // null),
            typeId:(.payload.typeId // null),
            actionId:(.payload.actionId // null),
            money:(.payload.money // null),
            fDate:(.payload.fDate // null)
          },
          status:"not_attempted",
          flowId:null,
          errorCode:null
        }
      ]
    }') || ca_die "LOCAL_IO_ERROR" "cannot serialize import journal"
  ca_atomic_write "$journal" 600 <<<"$journal_json"
  CA_JOURNAL_FILE="$journal"
}

ca_journal_update_row() {
  local index="$1"
  local status="$2"
  local flow_id="$3"
  local error_code="$4"
  local tmp_json
  jq -e --argjson index "$index" 'any(.rows[]; .index == $index)' "$CA_JOURNAL_FILE" >/dev/null 2>&1 \
    || ca_die "LOCAL_IO_ERROR" "journal row index is missing"
  tmp_json=$(jq -c \
    --argjson index "$index" \
    --arg status "$status" \
    --arg flowId "$flow_id" \
    --arg errorCode "$error_code" \
    '(.rows[] | select(.index == $index)) |= (
      .status=$status |
      .flowId=(if $flowId == "" then null else ($flowId|tonumber? // $flowId) end) |
      .errorCode=(if $errorCode == "" then null else $errorCode end)
    )' "$CA_JOURNAL_FILE") || ca_die "LOCAL_IO_ERROR" "cannot update import journal"
  ca_atomic_write "$CA_JOURNAL_FILE" 600 <<<"$tmp_json"
}

ca_journal_finish() {
  local state="$1"
  local tmp_json
  tmp_json=$(jq -c --arg state "$state" --arg finishedAt "$(ca_now_utc)" '.state=$state | .finishedAt=$finishedAt' "$CA_JOURNAL_FILE") \
    || ca_die "LOCAL_IO_ERROR" "cannot finalize import journal"
  ca_atomic_write "$CA_JOURNAL_FILE" 600 <<<"$tmp_json"
}
