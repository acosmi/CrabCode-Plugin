#!/usr/bin/env bash

ca_md5_available() {
  command -v md5 >/dev/null 2>&1 || command -v md5sum >/dev/null 2>&1 || command -v openssl >/dev/null 2>&1
}

ca_md5_text() {
  local value="$1"
  if command -v md5 >/dev/null 2>&1; then
    printf '%s' "$value" | md5 -q
  elif command -v md5sum >/dev/null 2>&1; then
    printf '%s' "$value" | md5sum | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    printf '%s' "$value" | openssl md5 | awk '{print $NF}'
  else
    return 1
  fi
}

ca_read_password() {
  CA_PASSWORD_VALUE=""
  if [[ -n "${CRABACCOUNT_PASSWORD:-}" ]]; then
    CA_PASSWORD_VALUE="$CRABACCOUNT_PASSWORD"
    unset CRABACCOUNT_PASSWORD
    return 0
  fi
  if [[ -r /dev/tty ]]; then
    printf 'CrabAccount password: ' >/dev/tty
    IFS= read -r -s CA_PASSWORD_VALUE </dev/tty || true
    printf '\n' >/dev/tty
  fi
  [[ -n "$CA_PASSWORD_VALUE" ]]
}

ca_login_internal() {
  local allow_tty="$1"
  local password hashed body token
  [[ -n "$CA_USERNAME" ]] || return 1
  if [[ "$allow_tty" == "true" ]]; then
    ca_read_password || return 1
  else
    [[ -n "${CRABACCOUNT_PASSWORD:-}" ]] || return 1
    CA_PASSWORD_VALUE="$CRABACCOUNT_PASSWORD"
    unset CRABACCOUNT_PASSWORD
  fi
  password="$CA_PASSWORD_VALUE"
  CA_PASSWORD_VALUE=""
  ca_md5_available || ca_die "DEPENDENCY_MISSING" "md5, md5sum, or openssl is required for the legacy login protocol"
  hashed=$(ca_md5_text "$password") || return 1
  password=""
  body=$(jq -cn --arg username "$CA_USERNAME" --arg password "$hashed" '{username:$username,password:$password}')
  hashed=""
  ca_api_raw "POST" "/auth/login" "$body" "read" "noauth"
  body=""
  if [[ "$CA_CURL_RC" != "0" || ( "$CA_HTTP_STATUS" != "200" && "$CA_HTTP_STATUS" != "201" ) ]]; then
    return 1
  fi
  jq -e . >/dev/null 2>&1 <<<"$CA_HTTP_BODY" || return 1
  [[ "$(jq -r '.code // 0' <<<"$CA_HTTP_BODY")" == "0" ]] || return 1
  token=$(jq -r '.data.token // empty' <<<"$CA_HTTP_BODY")
  [[ -n "$token" ]] || return 1
  ca_save_token "$token"
  token=""
  CA_HTTP_BODY=""
  return 0
}

ca_try_session_login() {
  ca_login_internal "false"
}
