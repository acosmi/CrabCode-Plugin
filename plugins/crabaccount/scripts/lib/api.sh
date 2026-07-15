#!/usr/bin/env bash

ca_curl_once() {
  local method="$1"
  local path="$2"
  local body="$3"
  local auth_mode="$4"
  local response_file error_file body_file status token
  response_file=$(mktemp "$CA_TMP_DIR/response.XXXXXX") || return 1
  error_file=$(mktemp "$CA_TMP_DIR/error.XXXXXX") || { rm -f "$response_file"; return 1; }
  chmod 600 "$response_file" "$error_file" \
    || { rm -f "$response_file" "$error_file"; ca_die "LOCAL_IO_ERROR" "cannot protect request temporary files"; }
  body_file=""
  if [[ "$method" != "GET" && -n "$body" ]]; then
    body_file=$(mktemp "$CA_TMP_DIR/body.XXXXXX") || { rm -f "$response_file" "$error_file"; return 1; }
    chmod 600 "$body_file" \
      || { rm -f "$response_file" "$error_file" "$body_file"; ca_die "LOCAL_IO_ERROR" "cannot protect request body"; }
    printf '%s' "$body" > "$body_file"
  fi

  token=""
  if [[ "$auth_mode" == "auth" ]]; then
    ca_load_token
    token="$CA_TOKEN"
  fi

  local -a args
  args=(
    --silent
    --show-error
    --connect-timeout 10
    --max-time 30
    --proto '=http,https'
    --output "$response_file"
    --write-out '%{http_code}'
    --request "$method"
    --header 'Content-Type: application/json; charset=utf-8'
  )
  if [[ -n "$body_file" ]]; then
    args+=(--data-binary "@$body_file")
  fi
  args+=("${CA_API_BASE}${path}")

  if [[ -n "$token" ]]; then
    status=$(printf 'header = "authorization: %s"\n' "$token" | curl --config - "${args[@]}" 2>"$error_file")
    CA_CURL_RC=$?
  else
    status=$(curl "${args[@]}" 2>"$error_file")
    CA_CURL_RC=$?
  fi
  token=""
  CA_HTTP_STATUS="${status:-000}"
  CA_HTTP_BODY=$(cat "$response_file")
  rm -f "$response_file" "$error_file"
  [[ -z "$body_file" ]] || rm -f "$body_file"
}

ca_api_raw() {
  local method="$1"
  local path="$2"
  local body="$3"
  local mode="$4"
  local auth_mode="$5"
  local attempts=1
  local max_attempts=1
  local delay="${CRABACCOUNT_RETRY_DELAY_SECONDS:-1}"
  if [[ "$mode" == "read" ]]; then
    max_attempts=3
  fi
  while true; do
    ca_curl_once "$method" "$path" "$body" "$auth_mode"
    if [[ "$mode" != "read" ]]; then
      return 0
    fi
    if [[ "$CA_CURL_RC" == "0" ]]; then
      case "$CA_HTTP_STATUS" in
        429|502|503|504) ;;
        *) return 0 ;;
      esac
    fi
    if (( attempts >= max_attempts )); then
      return 0
    fi
    sleep "$delay"
    attempts=$((attempts + 1))
  done
}

ca_api_call() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local mode="${4:-read}"
  local biz_code message
  CA_RESULT_STATE=""
  CA_ERROR_CODE=""
  CA_ERROR_MESSAGE=""
  CA_RESPONSE=""

  ca_api_raw "$method" "$path" "$body" "$mode" "auth"
  if [[ "$mode" == "read" && ( "$CA_HTTP_STATUS" == "401" || "$CA_HTTP_STATUS" == "418" ) ]]; then
    if ca_try_session_login; then
      ca_api_raw "$method" "$path" "$body" "$mode" "auth"
    fi
  fi

  if [[ "$CA_CURL_RC" != "0" ]]; then
    if [[ "$mode" == "write" ]]; then
      CA_RESULT_STATE="commit_unknown"
      CA_ERROR_CODE="COMMIT_UNKNOWN"
      CA_ERROR_MESSAGE="write request ended with a transport error; reconcile before retrying"
    else
      CA_RESULT_STATE="error"
      CA_ERROR_CODE="NETWORK_ERROR"
      CA_ERROR_MESSAGE="ledger request failed after bounded retries"
    fi
    return 1
  fi

  case "$CA_HTTP_STATUS" in
    200|201)
      if ! jq -e . >/dev/null 2>&1 <<<"$CA_HTTP_BODY"; then
        if [[ "$mode" == "write" ]]; then
          CA_RESULT_STATE="commit_unknown"
          CA_ERROR_CODE="COMMIT_UNKNOWN"
          CA_ERROR_MESSAGE="write response was empty or not JSON; reconcile before retrying"
        else
          CA_RESULT_STATE="error"
          CA_ERROR_CODE="REMOTE_RESPONSE_INVALID"
          CA_ERROR_MESSAGE="ledger returned an empty or non-JSON response"
        fi
        return 1
      fi
      biz_code=$(jq -r '.code // 0' <<<"$CA_HTTP_BODY")
      if [[ "$biz_code" != "0" ]]; then
        message=$(jq -r '.msg // "ledger rejected the request"' <<<"$CA_HTTP_BODY")
        if [[ "$mode" == "write" ]]; then
          CA_RESULT_STATE="confirmed_failed"
          CA_ERROR_CODE="REMOTE_REJECTED"
        else
          CA_RESULT_STATE="error"
          CA_ERROR_CODE="REMOTE_ERROR"
        fi
        CA_ERROR_MESSAGE="$message"
        return 1
      fi
      CA_RESULT_STATE="success"
      CA_RESPONSE="$CA_HTTP_BODY"
      return 0
      ;;
    401|418)
      ca_clear_token
      CA_RESULT_STATE="confirmed_failed"
      CA_ERROR_CODE="AUTH_REQUIRED"
      CA_ERROR_MESSAGE="authentication is required; run auth login in your own terminal"
      return 1
      ;;
    400|402|403|404|405|409|410|412|415|422)
      if [[ "$mode" == "write" ]]; then
        CA_RESULT_STATE="confirmed_failed"
        CA_ERROR_CODE="REMOTE_REJECTED"
      else
        CA_RESULT_STATE="error"
        CA_ERROR_CODE="REMOTE_ERROR"
      fi
      CA_ERROR_MESSAGE="ledger returned HTTP $CA_HTTP_STATUS"
      return 1
      ;;
    500|501|502|503|504|505)
      if [[ "$mode" == "write" ]]; then
        CA_RESULT_STATE="commit_unknown"
        CA_ERROR_CODE="COMMIT_UNKNOWN"
        CA_ERROR_MESSAGE="ledger returned HTTP $CA_HTTP_STATUS after a write; reconcile before retrying"
      else
        CA_RESULT_STATE="error"
        CA_ERROR_CODE="REMOTE_ERROR"
        CA_ERROR_MESSAGE="ledger returned HTTP $CA_HTTP_STATUS"
      fi
      return 1
      ;;
    *)
      if [[ "$mode" == "write" ]]; then
        CA_RESULT_STATE="commit_unknown"
        CA_ERROR_CODE="COMMIT_UNKNOWN"
      else
        CA_RESULT_STATE="error"
        CA_ERROR_CODE="REMOTE_ERROR"
      fi
      CA_ERROR_MESSAGE="unexpected HTTP status ${CA_HTTP_STATUS:-000}"
      return 1
      ;;
  esac
}

ca_require_api_success() {
  if [[ "$CA_RESULT_STATE" != "success" ]]; then
    ca_die "${CA_ERROR_CODE:-REMOTE_ERROR}" "${CA_ERROR_MESSAGE:-ledger request failed}" 3
  fi
}

ca_require_compatibility() {
  local api_hash stored_hash compatible release
  [[ -f "$CA_COMPAT_FILE" ]] || ca_die "COMPATIBILITY_REQUIRED" "run doctor successfully before any write" 3
  [[ ! -L "$CA_COMPAT_FILE" ]] || ca_die "UNSAFE_PATH" "compatibility file must not be a symbolic link"
  chmod 600 "$CA_COMPAT_FILE" || ca_die "LOCAL_IO_ERROR" "cannot protect compatibility record"
  api_hash=$(ca_sha256_text "$CA_API_BASE")
  stored_hash=$(jq -r '.apiBaseHash // ""' "$CA_COMPAT_FILE" 2>/dev/null || true)
  compatible=$(jq -r '.compatible // false' "$CA_COMPAT_FILE" 2>/dev/null || true)
  release=$(jq -r '.release // ""' "$CA_COMPAT_FILE" 2>/dev/null || true)
  [[ "$stored_hash" == "$api_hash" && "$compatible" == "true" ]] || ca_die "COMPATIBILITY_REQUIRED" "doctor compatibility record does not match the configured ledger" 3
  case "$release" in
    2.7.*|v2.7.*) ;;
    *) ca_die "UNSUPPORTED_VERSION" "only the observed 2.7.x service contract is enabled for writes" 3 ;;
  esac
}
