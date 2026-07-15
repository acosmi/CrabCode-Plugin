#!/usr/bin/env bash
# shellcheck source-path=SCRIPTDIR

set -uo pipefail
umask 077

SCRIPT_DIR=$(unset CDPATH; cd -- "$(dirname -- "$0")" && pwd -P)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/auth.sh
source "$SCRIPT_DIR/lib/auth.sh"
# shellcheck source=lib/api.sh
source "$SCRIPT_DIR/lib/api.sh"
# shellcheck source=lib/journal.sh
source "$SCRIPT_DIR/lib/journal.sh"

ca_usage() {
  cat >&2 <<'EOF'
Usage: crabaccount.sh --data-dir ABSOLUTE_PATH <command>

Commands:
  doctor
  config show
  config set --base-url URL [--username USER]
  auth status
  auth login
  accounts list
  categories list
  actions list
  flows get --flow-id ID
  flows query --handle 0|1|2|3 [filters]
  flows stats --year YYYY
  flows export --name NAME --handle 0|1|2|3 [filters] [--apply --digest SHA256]
  flows add --account-id ID --type-id ID --action-id ID --money DECIMAL --date YYYY-MM-DD [--note TEXT] [--collect true|false]
  flows update --flow-id ID [changed fields] [--apply --digest SHA256]
  transfers create --account-id ID --account-to-id ID --type-id ID --action-id ID --money DECIMAL --date YYYY-MM-DD [--note TEXT]
  import preview --file ABSOLUTE_PATH
  import apply --digest SHA256
  import status --run-id RUN_ID
EOF
}

ca_is_positive_int() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

ca_is_boolean() {
  [[ "$1" == "true" || "$1" == "false" ]]
}

ca_is_date() {
  local value="$1"
  local parsed=""
  [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || return 1
  if date -j -f '%Y-%m-%d' "$value" '+%Y-%m-%d' >/dev/null 2>&1; then
    parsed=$(date -j -f '%Y-%m-%d' "$value" '+%Y-%m-%d' 2>/dev/null)
    [[ "$parsed" == "$value" ]]
  elif date -d "$value" '+%Y-%m-%d' >/dev/null 2>&1; then
    parsed=$(date -d "$value" '+%Y-%m-%d' 2>/dev/null)
    [[ "$parsed" == "$value" ]]
  else
    return 0
  fi
}

ca_normalize_money() {
  local value="$1"
  local whole fraction
  [[ "$value" =~ ^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$ ]] || return 1
  whole="${value%%.*}"
  if [[ "$value" == *.* ]]; then
    fraction="${value#*.}"
  else
    fraction=""
  fi
  case "${#fraction}" in
    0) fraction="00" ;;
    1) fraction="${fraction}0" ;;
  esac
  [[ "$whole" != "0" || "$fraction" != "00" ]] || return 1
  CA_MONEY_NORMALIZED="${whole}.${fraction}"
}

ca_require_ready() {
  ca_require_core_deps
  ca_load_config
}

ca_command_doctor() {
  local missing="[]"
  local bash_ok=true curl_ok=true jq_ok=true sha_ok=true md5_ok=true
  if (( BASH_VERSINFO[0] < 3 )); then bash_ok=false; fi
  if ! command -v curl >/dev/null 2>&1; then curl_ok=false; missing='["curl"]'; fi
  if ! command -v jq >/dev/null 2>&1; then
    jq_ok=false
    if [[ "$missing" == "[]" ]]; then missing='["jq"]'; else missing='["curl","jq"]'; fi
  fi
  if ! ca_sha256_available; then sha_ok=false; fi
  if ! ca_md5_available; then md5_ok=false; fi
  if [[ "$bash_ok" != "true" || "$curl_ok" != "true" || "$jq_ok" != "true" || "$sha_ok" != "true" || "$md5_ok" != "true" ]]; then
    if command -v jq >/dev/null 2>&1; then
      jq -cn \
        --argjson bash "$bash_ok" --argjson curl "$curl_ok" --argjson jq "$jq_ok" \
        --argjson sha256 "$sha_ok" --argjson md5 "$md5_ok" --argjson missing "$missing" \
        '{ok:false,operation:"doctor",local:{bash:$bash,curl:$curl,jq:$jq,sha256:$sha256,md5:$md5},missing:$missing,compatible:false,error:{code:"DEPENDENCY_MISSING",message:"install the missing local dependencies"}}'
    else
      printf '{"ok":false,"operation":"doctor","compatible":false,"error":{"code":"DEPENDENCY_MISSING","message":"jq is required"}}\n'
    fi
    return 2
  fi

  if [[ ! -f "$CA_CONFIG_FILE" ]]; then
    jq -cn '{ok:false,operation:"doctor",local:{bash:true,curl:true,jq:true,sha256:true,md5:true},compatible:false,error:{code:"CONFIG_REQUIRED",message:"run config set before remote compatibility checks"}}'
    return 2
  fi

  ca_load_config
  local version accounts categories actions release api_hash compatibility_json
  ca_api_call "GET" "/home/getVersion" "" "read"
  if [[ "$CA_RESULT_STATE" != "success" ]]; then
    ca_error_json "$CA_ERROR_CODE" "$CA_ERROR_MESSAGE"
    return 3
  fi
  version="$CA_RESPONSE"
  ca_api_call "GET" "/account/getAccount" "" "read"
  if [[ "$CA_RESULT_STATE" != "success" ]]; then ca_error_json "$CA_ERROR_CODE" "$CA_ERROR_MESSAGE"; return 3; fi
  accounts="$CA_RESPONSE"
  ca_api_call "GET" "/type/getType" "" "read"
  if [[ "$CA_RESULT_STATE" != "success" ]]; then ca_error_json "$CA_ERROR_CODE" "$CA_ERROR_MESSAGE"; return 3; fi
  categories="$CA_RESPONSE"
  ca_api_call "GET" "/action/getAction" "" "read"
  if [[ "$CA_RESULT_STATE" != "success" ]]; then ca_error_json "$CA_ERROR_CODE" "$CA_ERROR_MESSAGE"; return 3; fi
  actions="$CA_RESPONSE"

  release=$(jq -r '.data.versions.release // empty' <<<"$version")
  if ! jq -e '.data.versions|type=="object" and (.release|type=="string")' >/dev/null 2>&1 <<<"$version" \
    || ! jq -e '(.data|type=="array") and all(.data[]; type=="object" and (.id|type=="number" and floor==.) and (.name|type=="string"))' >/dev/null 2>&1 <<<"$accounts" \
    || ! jq -e '(.data|type=="array") and all([.data[] | recurse(.childrenTypes[]?)][]; type=="object" and (.id|type=="number" and floor==.) and (.tname|type=="string") and (.childrenTypes|type=="array"))' >/dev/null 2>&1 <<<"$categories" \
    || ! jq -e '(.data|type=="array") and all(.data[]; type=="object" and (.id|type=="number" and floor==.) and (.hname|type=="string") and (.handle==0 or .handle==1 or .handle==2))' >/dev/null 2>&1 <<<"$actions"; then
    jq -cn --arg release "$release" '{ok:false,operation:"doctor",release:$release,compatible:false,error:{code:"SCHEMA_MISMATCH",message:"required read endpoint response shapes do not match the observed contract"}}'
    return 3
  fi
  case "$release" in
    2.7.*|v2.7.*) ;;
    *)
      jq -cn --arg release "$release" '{ok:false,operation:"doctor",release:$release,compatible:false,error:{code:"UNSUPPORTED_VERSION",message:"only the observed 2.7.x service contract is enabled for writes"}}'
      return 3
      ;;
  esac
  api_hash=$(ca_sha256_text "$CA_API_BASE")
  compatibility_json=$(jq -cn \
    --arg apiBaseHash "$api_hash" --arg release "$release" --arg checkedAt "$(ca_now_utc)" \
    --argjson accountCount "$(jq '.data|length' <<<"$accounts")" \
    --argjson categoryRootCount "$(jq '.data|length' <<<"$categories")" \
    --argjson actionCount "$(jq '.data|length' <<<"$actions")" \
    '{schemaVersion:1,compatible:true,apiBaseHash:$apiBaseHash,release:$release,checkedAt:$checkedAt,readShapes:{accounts:$accountCount,categoryRoots:$categoryRootCount,actions:$actionCount}}') \
    || ca_die "LOCAL_IO_ERROR" "cannot serialize compatibility record"
  ca_atomic_write "$CA_COMPAT_FILE" 600 <<<"$compatibility_json"
  jq -cn \
    --arg release "$release" \
    --argjson accounts "$(jq '.data|length' <<<"$accounts")" \
    --argjson categories "$(jq '[.data[] | .. | objects | select(has("tname"))] | length' <<<"$categories")" \
    --argjson actions "$(jq '.data|length' <<<"$actions")" \
    '{ok:true,operation:"doctor",local:{bash:true,curl:true,jq:true,sha256:true,md5:true},compatible:true,release:$release,readShapes:{accounts:$accounts,categories:$categories,actions:$actions},writeContract:"fixed-source-observed-plus-confirmation-and-verification"}'
}

ca_command_config() {
  local action="${1:-}"
  shift || true
  ca_require_core_deps
  case "$action" in
    show)
      if [[ ! -f "$CA_CONFIG_FILE" ]]; then
        jq -cn '{ok:true,operation:"config.show",configured:false,hasToken:false,compatible:false}'
        return 0
      fi
      ca_load_config
      local has_token=false compatible=false
      if [[ -f "$CA_TOKEN_FILE" ]]; then has_token=true; fi
      if [[ -f "$CA_COMPAT_FILE" ]] && jq -e '.compatible == true' "$CA_COMPAT_FILE" >/dev/null 2>&1; then compatible=true; fi
      jq -cn --arg baseUrl "$CA_BASE_URL" --arg username "$CA_USERNAME" --argjson hasToken "$has_token" --argjson compatible "$compatible" \
        '{ok:true,operation:"config.show",configured:true,baseUrl:$baseUrl,username:$username,hasToken:$hasToken,compatible:$compatible}'
      ;;
    set)
      local base_url="" username=""
      while (( $# > 0 )); do
        case "$1" in
          --base-url) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--base-url needs a value"; base_url="$2"; shift 2 ;;
          --username) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--username needs a value"; username="$2"; shift 2 ;;
          *) ca_die "VALIDATION_ERROR" "unknown config set option: $1" ;;
        esac
      done
      [[ -n "$base_url" ]] || ca_die "VALIDATION_ERROR" "--base-url is required"
      local url_rc
      if ca_validate_base_url "$base_url"; then
        url_rc=0
      else
        url_rc=$?
      fi
      if [[ "$url_rc" == "2" ]]; then
        ca_die "INSECURE_HTTP_BLOCKED" "non-loopback HTTP requires CRABACCOUNT_ALLOW_INSECURE_HTTP=1 in the parent process"
      elif [[ "$url_rc" != "0" ]]; then
        ca_die "VALIDATION_ERROR" "base URL must be a clean http(s) origin with an optional deployment prefix and without /api, userinfo, query, fragment, whitespace, or control characters"
      fi
      ca_save_config "$username"
      jq -cn --arg baseUrl "$CA_BASE_URL" --arg username "$CA_USERNAME" '{ok:true,operation:"config.set",baseUrl:$baseUrl,username:$username,tokenInvalidated:true,doctorRequired:true}'
      ;;
    *) ca_die "VALIDATION_ERROR" "config action must be show or set" ;;
  esac
}

ca_command_auth() {
  local action="${1:-}"
  ca_require_core_deps
  case "$action" in
    status)
      if [[ ! -f "$CA_CONFIG_FILE" ]]; then
        jq -cn '{ok:true,operation:"auth.status",configured:false,hasToken:false}'
        return 0
      fi
      ca_load_config
      ca_load_token
      jq -cn --argjson hasToken "$([[ -n "$CA_TOKEN" ]] && echo true || echo false)" --arg username "$CA_USERNAME" \
        '{ok:true,operation:"auth.status",configured:true,username:$username,hasToken:$hasToken}'
      ;;
    login)
      ca_load_config
      [[ -n "$CA_USERNAME" ]] || ca_die "CONFIG_REQUIRED" "configure a username before login"
      if ! ca_login_internal "true"; then
        ca_die "AUTH_FAILED" "login failed; verify the username, password, TLS endpoint, and service status" 3
      fi
      jq -cn '{ok:true,operation:"auth.login",tokenStored:true,message:"login succeeded; the password was not persisted"}'
      ;;
    *) ca_die "VALIDATION_ERROR" "auth action must be status or login" ;;
  esac
}

ca_read_list() {
  local operation="$1"
  local path="$2"
  ca_require_ready
  ca_api_call "GET" "$path" "" "read"
  ca_require_api_success
  jq -c --arg operation "$operation" '{ok:true,operation:$operation,data:(.data // [])}' <<<"$CA_RESPONSE"
}

ca_fetch_master_data() {
  ca_api_call "GET" "/account/getAccount" "" "read"
  ca_require_api_success
  CA_ACCOUNTS=$(jq -c '.data // []' <<<"$CA_RESPONSE")
  ca_api_call "GET" "/type/getType" "" "read"
  ca_require_api_success
  CA_CATEGORIES=$(jq -c '.data // []' <<<"$CA_RESPONSE")
  ca_api_call "GET" "/action/getAction" "" "read"
  ca_require_api_success
  CA_ACTIONS=$(jq -c '.data // []' <<<"$CA_RESPONSE")
}

ca_validate_master_ids() {
  local account_id="$1"
  local type_id="$2"
  local action_id="$3"
  local account_to_id="$4"
  local expected_handle="$5"
  local account category action target children actual_handle
  account=$(jq -c --argjson id "$account_id" 'map(select(.id == $id)) | first // empty' <<<"$CA_ACCOUNTS")
  [[ -n "$account" ]] || ca_die "VALIDATION_ERROR" "accountId does not exist"
  category=$(jq -c --argjson id "$type_id" '[.. | objects | select(.id? == $id and has("tname"))] | first // empty' <<<"$CA_CATEGORIES")
  [[ -n "$category" ]] || ca_die "VALIDATION_ERROR" "typeId does not exist"
  children=$(jq '(.childrenTypes // []) | length' <<<"$category")
  [[ "$children" == "0" ]] || ca_die "VALIDATION_ERROR" "typeId points to a parent category with children"
  action=$(jq -c --argjson id "$action_id" 'map(select(.id == $id)) | first // empty' <<<"$CA_ACTIONS")
  [[ -n "$action" ]] || ca_die "VALIDATION_ERROR" "actionId does not exist"
  actual_handle=$(jq -r '.handle // empty' <<<"$action")
  [[ "$actual_handle" =~ ^[012]$ ]] || ca_die "SCHEMA_MISMATCH" "selected action does not expose a supported handle"
  if [[ -n "$expected_handle" && "$actual_handle" != "$expected_handle" ]]; then
    ca_die "VALIDATION_ERROR" "selected action handle does not match the requested transaction kind"
  fi
  target=""
  if [[ -n "$account_to_id" ]]; then
    [[ "$account_to_id" != "$account_id" ]] || ca_die "VALIDATION_ERROR" "source and target accounts must differ"
    target=$(jq -c --argjson id "$account_to_id" 'map(select(.id == $id)) | first // empty' <<<"$CA_ACCOUNTS")
    [[ -n "$target" ]] || ca_die "VALIDATION_ERROR" "accountToId does not exist"
    [[ "$actual_handle" == "2" ]] || ca_die "VALIDATION_ERROR" "accountToId requires an action whose handle is 2"
  elif [[ "$actual_handle" == "2" ]]; then
    ca_die "VALIDATION_ERROR" "a transfer action requires accountToId"
  fi
  CA_ACCOUNT_NAME=$(jq -r '.name // ""' <<<"$account")
  CA_CATEGORY_NAME=$(jq -r '.tname // ""' <<<"$category")
  CA_ACTION_NAME=$(jq -r '.hname // ""' <<<"$action")
  CA_ACTION_HANDLE="$actual_handle"
  CA_TARGET_NAME=$(if [[ -n "$target" ]]; then jq -r '.name // ""' <<<"$target"; else printf ''; fi)
}

ca_emit_preview() {
  local operation="$1"
  local binding="$2"
  ca_prepare_preview "$binding"
  jq -cn \
    --arg operation "$operation" --arg runId "$CA_RUN_ID" --arg previewDigest "$CA_PREVIEW_DIGEST" \
    --argjson binding "$binding" \
    '{ok:true,operation:$operation,mode:"preview",runId:$runId,previewDigest:$previewDigest,requiresConfirmation:true,preview:($binding.preview // {}),operationCount:($binding.operations|length)}'
}

ca_verify_flow_payload() {
  local response="$1"
  local payload="$2"
  jq -e --argjson payload "$payload" '
    (.data.account.id == $payload.accountId) and
    (.data.type.id == $payload.typeId) and
    (.data.action.id == $payload.actionId) and
    ((.data.money|tostring) == ($payload.money|tostring)) and
    ((.data.fdate|tostring) == ($payload.fDate|tostring)) and
    ((.data.note // "") == ($payload.note // "")) and
    ((.data.collect // false) == ($payload.collect // false)) and
    (if $payload.accountToId then .data.accountTo.id == $payload.accountToId else true end)
  ' >/dev/null 2>&1 <<<"$response"
}

ca_execute_operation() {
  local operation="$1"
  local type payload path flow_id expected_pre current_hash current_data
  type=$(jq -r '.type' <<<"$operation")
  payload=$(jq -c '.payload // {}' <<<"$operation")
  CA_OPERATION_STATUS=""
  CA_OPERATION_FLOW_ID=""
  CA_OPERATION_ERROR=""
  case "$type" in
    add)
      ca_api_call "POST" "/flow/addFlow" "$payload" "write"
      if [[ "$CA_RESULT_STATE" != "success" ]]; then
        CA_OPERATION_STATUS="$CA_RESULT_STATE"
        CA_OPERATION_ERROR="$CA_ERROR_CODE"
        return 0
      fi
      flow_id=$(jq -r '.data.id // empty' <<<"$CA_RESPONSE")
      if ! ca_is_positive_int "$flow_id"; then
        CA_OPERATION_STATUS="commit_unknown"
        CA_OPERATION_ERROR="COMMIT_UNKNOWN"
        return 0
      fi
      CA_OPERATION_FLOW_ID="$flow_id"
      ca_api_call "GET" "/flow/getFlow/${flow_id}" "" "read"
      if [[ "$CA_RESULT_STATE" != "success" ]] || ! ca_verify_flow_payload "$CA_RESPONSE" "$payload"; then
        CA_OPERATION_STATUS="commit_unknown"
        CA_OPERATION_ERROR="VERIFY_FAILED"
        return 0
      fi
      CA_OPERATION_STATUS="success"
      ;;
    update)
      flow_id=$(jq -r '.flowId' <<<"$operation")
      expected_pre=$(jq -r '.preconditionFingerprint' <<<"$operation")
      ca_api_call "GET" "/flow/getFlow/${flow_id}" "" "read"
      if [[ "$CA_RESULT_STATE" != "success" ]]; then
        CA_OPERATION_STATUS="confirmed_failed"
        CA_OPERATION_ERROR="PRECONDITION_READ_FAILED"
        return 0
      fi
      current_data=$(jq -cS '.data' <<<"$CA_RESPONSE")
      current_hash=$(ca_sha256_text "$current_data")
      if [[ "$current_hash" != "$expected_pre" ]]; then
        CA_OPERATION_STATUS="confirmed_failed"
        CA_OPERATION_ERROR="PRECONDITION_CHANGED"
        return 0
      fi
      ca_api_call "PUT" "/flow/updateFlow/${flow_id}" "$payload" "write"
      if [[ "$CA_RESULT_STATE" != "success" ]]; then
        CA_OPERATION_STATUS="$CA_RESULT_STATE"
        CA_OPERATION_ERROR="$CA_ERROR_CODE"
        return 0
      fi
      CA_OPERATION_FLOW_ID="$flow_id"
      ca_api_call "GET" "/flow/getFlow/${flow_id}" "" "read"
      if [[ "$CA_RESULT_STATE" != "success" ]] || ! ca_verify_flow_payload "$CA_RESPONSE" "$payload"; then
        CA_OPERATION_STATUS="commit_unknown"
        CA_OPERATION_ERROR="VERIFY_FAILED"
        return 0
      fi
      CA_OPERATION_STATUS="success"
      ;;
    export)
      path=$(jq -r '.path' <<<"$operation")
      ca_api_call "POST" "$path" "$payload" "write"
      if [[ "$CA_RESULT_STATE" != "success" ]]; then
        CA_OPERATION_STATUS="$CA_RESULT_STATE"
        CA_OPERATION_ERROR="$CA_ERROR_CODE"
        return 0
      fi
      if ! jq -e '.data.success == true' >/dev/null 2>&1 <<<"$CA_RESPONSE"; then
        CA_OPERATION_STATUS="confirmed_failed"
        CA_OPERATION_ERROR="REMOTE_REJECTED"
        return 0
      fi
      CA_OPERATION_STATUS="success"
      ;;
    *)
      CA_OPERATION_STATUS="confirmed_failed"
      CA_OPERATION_ERROR="UNSUPPORTED_OPERATION"
      ;;
  esac
}

ca_apply_digest() {
  local expected_operation="$1"
  local digest="$2"
  local binding_operation operation_count position operation_index operation stop=false
  local success_count failed_count unknown_count not_attempted state exit_code
  ca_require_ready
  ca_load_pending "$digest"
  binding_operation=$(jq -r '.operation' <<<"$CA_BINDING")
  [[ "$binding_operation" == "$expected_operation" ]] || ca_die "PREVIEW_OPERATION_MISMATCH" "digest belongs to a different operation"
  [[ "$(jq -r '.apiBase' <<<"$CA_BINDING")" == "$CA_API_BASE" ]] || ca_die "DIGEST_MISMATCH" "configured API base changed after preview"
  ca_require_compatibility
  ca_lock_acquire
  ca_create_journal
  operation_count=$(jq '.operations|length' <<<"$CA_BINDING")
  for (( position=0; position<operation_count; position++ )); do
    if [[ "$stop" == "true" ]]; then
      break
    fi
    operation=$(jq -c --argjson position "$position" '.operations[$position]' <<<"$CA_BINDING")
    operation_index=$(jq -r '.index' <<<"$operation")
    ca_execute_operation "$operation"
    ca_journal_update_row "$operation_index" "$CA_OPERATION_STATUS" "$CA_OPERATION_FLOW_ID" "$CA_OPERATION_ERROR"
    if [[ "$CA_OPERATION_STATUS" == "commit_unknown" ]]; then
      stop=true
    fi
  done
  success_count=$(jq '[.rows[] | select(.status=="success")]|length' "$CA_JOURNAL_FILE")
  failed_count=$(jq '[.rows[] | select(.status=="confirmed_failed")]|length' "$CA_JOURNAL_FILE")
  unknown_count=$(jq '[.rows[] | select(.status=="commit_unknown")]|length' "$CA_JOURNAL_FILE")
  not_attempted=$(jq '[.rows[] | select(.status=="not_attempted")]|length' "$CA_JOURNAL_FILE")
  state="completed"
  exit_code=0
  if (( unknown_count > 0 )); then
    state="commit_unknown"
    exit_code=4
  elif (( failed_count > 0 || not_attempted > 0 )); then
    state="partial"
    exit_code=5
  fi
  ca_journal_finish "$state"
  [[ ! -L "$CA_PENDING_FILE" ]] || ca_die "UNSAFE_PATH" "pending preview must not be a symbolic link"
  rm -f "$CA_PENDING_FILE" || ca_die "LOCAL_IO_ERROR" "cannot remove attempted pending preview"
  ca_lock_release
  jq -c \
    --arg operation "$expected_operation" \
    --argjson success "$success_count" --argjson failed "$failed_count" \
    --argjson unknown "$unknown_count" --argjson notAttempted "$not_attempted" \
    '{ok:($unknown==0 and $failed==0 and $notAttempted==0),operation:$operation,mode:"apply",runId:.runId,state:.state,summary:{success:$success,confirmedFailed:$failed,commitUnknown:$unknown,notAttempted:$notAttempted},rows:.rows}' \
    "$CA_JOURNAL_FILE"
  return "$exit_code"
}

ca_parse_query_args() {
  local handle="" account_id="" start_date="" end_date="" note="" single_month="" types="" order_by=""
  CA_EXPORT_NAME=""
  CA_APPLY=false
  CA_DIGEST=""
  while (( $# > 0 )); do
    case "$1" in
      --handle) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--handle needs a value"; handle="$2"; shift 2 ;;
      --account-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--account-id needs a value"; account_id="$2"; shift 2 ;;
      --start-date) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--start-date needs a value"; start_date="$2"; shift 2 ;;
      --end-date) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--end-date needs a value"; end_date="$2"; shift 2 ;;
      --note) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--note needs a value"; note="$2"; shift 2 ;;
      --single-month) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--single-month needs a value"; single_month="$2"; shift 2 ;;
      --types) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--types needs a value"; types="$2"; shift 2 ;;
      --order-by) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--order-by needs a value"; order_by="$2"; shift 2 ;;
      --name) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--name needs a value"; CA_EXPORT_NAME="$2"; shift 2 ;;
      --apply) CA_APPLY=true; shift ;;
      --digest) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--digest needs a value"; CA_DIGEST="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown query option: $1" ;;
    esac
  done
  [[ "$handle" =~ ^[0123]$ ]] || ca_die "VALIDATION_ERROR" "--handle must be 0, 1, 2, or 3"
  [[ -z "$account_id" ]] || ca_is_positive_int "$account_id" || ca_die "VALIDATION_ERROR" "--account-id must be a positive integer"
  [[ -z "$start_date" ]] || ca_is_date "$start_date" || ca_die "VALIDATION_ERROR" "--start-date must be a real YYYY-MM-DD date"
  [[ -z "$end_date" ]] || ca_is_date "$end_date" || ca_die "VALIDATION_ERROR" "--end-date must be a real YYYY-MM-DD date"
  [[ -z "$single_month" ]] || ca_is_boolean "$single_month" || ca_die "VALIDATION_ERROR" "--single-month must be true or false"
  [[ -z "$order_by" || "$order_by" =~ ^[012]$ ]] || ca_die "VALIDATION_ERROR" "--order-by must be 0, 1, or 2"
  local types_json='[]'
  if [[ -n "$types" ]]; then
    [[ "$types" =~ ^[1-9][0-9]*(,[1-9][0-9]*)*$ ]] || ca_die "VALIDATION_ERROR" "--types must be comma-separated positive integers"
    types_json=$(jq -cn --arg values "$types" '$values|split(",")|map(tonumber)')
  fi
  CA_QUERY_BODY=$(jq -cn \
    --argjson handle "$handle" --arg accountId "$account_id" --arg startDate "$start_date" \
    --arg endDate "$end_date" --arg note "$note" --arg singleMonth "$single_month" \
    --argjson types "$types_json" --arg orderBy "$order_by" '
      {chooseHandle:$handle,actions:[],collect:false,types:$types}
      + (if $accountId=="" then {} else {accountId:($accountId|tonumber)} end)
      + (if $startDate=="" then {} else {startDate:$startDate} end)
      + (if $endDate=="" then {} else {endDate:$endDate} end)
      + (if $note=="" then {} else {note:$note} end)
      + (if $singleMonth=="" then {} else {singleMonth:($singleMonth=="true")} end)
      + (if $orderBy=="" then {} else {orderBy:($orderBy|tonumber)} end)
    ')
}

ca_command_flows_get() {
  local flow_id=""
  shift || true
  while (( $# > 0 )); do
    case "$1" in
      --flow-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--flow-id needs a value"; flow_id="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown flows get option: $1" ;;
    esac
  done
  ca_is_positive_int "$flow_id" || ca_die "VALIDATION_ERROR" "--flow-id must be a positive integer"
  ca_require_ready
  ca_api_call "GET" "/flow/getFlow/${flow_id}" "" "read"
  ca_require_api_success
  jq -c '{ok:true,operation:"flows.get",data:.data}' <<<"$CA_RESPONSE"
}

ca_command_flows_query() {
  shift || true
  ca_parse_query_args "$@"
  ca_require_ready
  ca_api_call "POST" "/screen/getFlowByScreen" "$CA_QUERY_BODY" "read"
  ca_require_api_success
  jq -c '{ok:true,operation:"flows.query",data:.data,completeness:{serverPagination:"unverified",clientTruncation:false}}' <<<"$CA_RESPONSE"
}

ca_command_flows_stats() {
  local year=""
  shift || true
  while (( $# > 0 )); do
    case "$1" in
      --year) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--year needs a value"; year="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown flows stats option: $1" ;;
    esac
  done
  [[ "$year" =~ ^[0-9]{4}$ ]] || ca_die "VALIDATION_ERROR" "--year must be four digits"
  ca_require_ready
  ca_api_call "GET" "/home/getHomeInfoV2/${year}" "" "read"
  ca_require_api_success
  jq -c --arg year "$year" '{ok:true,operation:"flows.stats",year:($year|tonumber),data:.data}' <<<"$CA_RESPONSE"
}

ca_command_add_like() {
  local operation="$1"
  shift
  local account_id="" account_to_id="" type_id="" action_id="" money="" fdate="" note="" collect=false
  local apply=false digest="" expected_handle="" payload request_fingerprint operation_json binding
  while (( $# > 0 )); do
    case "$1" in
      --account-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--account-id needs a value"; account_id="$2"; shift 2 ;;
      --account-to-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--account-to-id needs a value"; account_to_id="$2"; shift 2 ;;
      --type-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--type-id needs a value"; type_id="$2"; shift 2 ;;
      --action-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--action-id needs a value"; action_id="$2"; shift 2 ;;
      --money) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--money needs a value"; money="$2"; shift 2 ;;
      --date) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--date needs a value"; fdate="$2"; shift 2 ;;
      --note) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--note needs a value"; note="$2"; shift 2 ;;
      --collect) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--collect needs a value"; collect="$2"; shift 2 ;;
      --apply) apply=true; shift ;;
      --digest) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--digest needs a value"; digest="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown write option: $1" ;;
    esac
  done
  if [[ "$apply" == "true" ]]; then
    [[ -n "$digest" ]] || ca_die "VALIDATION_ERROR" "--apply requires --digest"
    ca_apply_digest "$operation" "$digest"
    return $?
  fi
  [[ -z "$digest" ]] || ca_die "VALIDATION_ERROR" "--digest is only valid with --apply"
  ca_is_positive_int "$account_id" || ca_die "VALIDATION_ERROR" "--account-id must be a positive integer"
  ca_is_positive_int "$type_id" || ca_die "VALIDATION_ERROR" "--type-id must be a positive integer"
  ca_is_positive_int "$action_id" || ca_die "VALIDATION_ERROR" "--action-id must be a positive integer"
  ca_normalize_money "$money" || ca_die "VALIDATION_ERROR" "--money must be a positive decimal with at most two fractional digits"
  money="$CA_MONEY_NORMALIZED"
  ca_is_date "$fdate" || ca_die "VALIDATION_ERROR" "--date must be a real YYYY-MM-DD date"
  ca_is_boolean "$collect" || ca_die "VALIDATION_ERROR" "--collect must be true or false"
  if [[ "$operation" == "transfer" ]]; then
    ca_is_positive_int "$account_to_id" || ca_die "VALIDATION_ERROR" "transfers require a positive --account-to-id"
    expected_handle="2"
  else
    [[ -z "$account_to_id" ]] || ca_die "VALIDATION_ERROR" "use transfers create for internal transfers"
  fi
  ca_require_ready
  ca_require_compatibility
  ca_fetch_master_data
  ca_validate_master_ids "$account_id" "$type_id" "$action_id" "$account_to_id" "$expected_handle"
  if [[ "$operation" == "flow-add" && "$CA_ACTION_HANDLE" == "2" ]]; then
    ca_die "VALIDATION_ERROR" "use transfers create for an action whose handle is 2"
  fi
  payload=$(jq -cn \
    --argjson accountId "$account_id" --argjson typeId "$type_id" --argjson actionId "$action_id" \
    --arg money "$money" --arg fDate "$fdate" --arg note "$note" --argjson collect "$collect" \
    --arg createDate "$(date '+%Y-%m-%d %H:%M:%S')" --arg accountToId "$account_to_id" '
      {accountId:$accountId,typeId:$typeId,actionId:$actionId,money:$money,fDate:$fDate,note:$note,collect:$collect,createDate:$createDate}
      + (if $accountToId=="" then {} else {accountToId:($accountToId|tonumber)} end)
    ')
  request_fingerprint=$(ca_sha256_text "$(jq -cS . <<<"$payload")")
  operation_json=$(jq -cn --argjson payload "$payload" --arg requestFingerprint "$request_fingerprint" \
    '{index:0,type:"add",source:{sheet:null,row:null,page:null,externalIdHash:null},payload:$payload,requestFingerprint:$requestFingerprint}')
  binding=$(jq -cn \
    --arg operation "$operation" --arg apiBase "$CA_API_BASE" --argjson operationJson "$operation_json" \
    --arg account "$CA_ACCOUNT_NAME" --arg target "$CA_TARGET_NAME" --arg category "$CA_CATEGORY_NAME" --arg action "$CA_ACTION_NAME" \
    --arg money "$money" --arg date "$fdate" --arg note "$note" '
      {schemaVersion:"1",operation:$operation,apiBase:$apiBase,inputSha256:null,operations:[$operationJson],preview:{account:$account,targetAccount:(if $target=="" then null else $target end),category:$category,action:$action,money:$money,date:$date,note:$note}}
    ')
  ca_emit_preview "$operation" "$binding"
}

ca_command_update() {
  shift || true
  local flow_id="" account_id="" type_id="" action_id="" money="" fdate="" note="" collect="" account_to_id=""
  local apply=false digest="" changed=false note_set=false original data create_date payload precondition operation_json binding request_fingerprint
  while (( $# > 0 )); do
    case "$1" in
      --flow-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--flow-id needs a value"; flow_id="$2"; shift 2 ;;
      --account-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--account-id needs a value"; account_id="$2"; changed=true; shift 2 ;;
      --account-to-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--account-to-id needs a value"; account_to_id="$2"; changed=true; shift 2 ;;
      --type-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--type-id needs a value"; type_id="$2"; changed=true; shift 2 ;;
      --action-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--action-id needs a value"; action_id="$2"; changed=true; shift 2 ;;
      --money) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--money needs a value"; money="$2"; changed=true; shift 2 ;;
      --date) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--date needs a value"; fdate="$2"; changed=true; shift 2 ;;
      --note) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--note needs a value"; note="$2"; note_set=true; changed=true; shift 2 ;;
      --collect) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--collect needs a value"; collect="$2"; changed=true; shift 2 ;;
      --apply) apply=true; shift ;;
      --digest) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--digest needs a value"; digest="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown update option: $1" ;;
    esac
  done
  if [[ "$apply" == "true" ]]; then
    [[ -n "$digest" ]] || ca_die "VALIDATION_ERROR" "--apply requires --digest"
    ca_apply_digest "flow-update" "$digest"
    return $?
  fi
  ca_is_positive_int "$flow_id" || ca_die "VALIDATION_ERROR" "--flow-id must be a positive integer"
  [[ "$changed" == "true" ]] || ca_die "VALIDATION_ERROR" "provide at least one field to update"
  [[ -z "$account_id" ]] || ca_is_positive_int "$account_id" || ca_die "VALIDATION_ERROR" "--account-id must be a positive integer"
  [[ -z "$account_to_id" ]] || ca_is_positive_int "$account_to_id" || ca_die "VALIDATION_ERROR" "--account-to-id must be a positive integer"
  [[ -z "$type_id" ]] || ca_is_positive_int "$type_id" || ca_die "VALIDATION_ERROR" "--type-id must be a positive integer"
  [[ -z "$action_id" ]] || ca_is_positive_int "$action_id" || ca_die "VALIDATION_ERROR" "--action-id must be a positive integer"
  if [[ -n "$money" ]]; then ca_normalize_money "$money" || ca_die "VALIDATION_ERROR" "--money must be a positive decimal"; money="$CA_MONEY_NORMALIZED"; fi
  [[ -z "$fdate" ]] || ca_is_date "$fdate" || ca_die "VALIDATION_ERROR" "--date must be a real YYYY-MM-DD date"
  [[ -z "$collect" ]] || ca_is_boolean "$collect" || ca_die "VALIDATION_ERROR" "--collect must be true or false"
  ca_require_ready
  ca_require_compatibility
  ca_api_call "GET" "/flow/getFlow/${flow_id}" "" "read"
  ca_require_api_success
  original="$CA_RESPONSE"
  data=$(jq -c '.data' <<<"$original")
  create_date=$(jq -r '.createDate // empty' <<<"$data")
  [[ -n "$create_date" ]] || ca_die "SCHEMA_MISMATCH" "flow detail lacks createDate; update is disabled to avoid destructive full replacement"
  account_id="${account_id:-$(jq -r '.account.id // empty' <<<"$data")}"
  type_id="${type_id:-$(jq -r '.type.id // empty' <<<"$data")}"
  action_id="${action_id:-$(jq -r '.action.id // empty' <<<"$data")}"
  money="${money:-$(jq -r '.money // empty' <<<"$data")}"
  fdate="${fdate:-$(jq -r '.fdate // empty' <<<"$data")}"
  if [[ "$note_set" != "true" ]]; then
    note=$(jq -r '.note // ""' <<<"$data")
  fi
  collect="${collect:-$(jq -r '.collect // false' <<<"$data")}"
  account_to_id="${account_to_id:-$(jq -r '.accountTo.id // empty' <<<"$data")}"
  ca_normalize_money "$money" || ca_die "SCHEMA_MISMATCH" "existing flow money is not a supported decimal"
  money="$CA_MONEY_NORMALIZED"
  ca_fetch_master_data
  ca_validate_master_ids "$account_id" "$type_id" "$action_id" "$account_to_id" ""
  payload=$(jq -cn \
    --argjson accountId "$account_id" --argjson typeId "$type_id" --argjson actionId "$action_id" \
    --arg money "$money" --arg fDate "$fdate" --arg note "$note" --argjson collect "$collect" \
    --arg createDate "$create_date" --arg accountToId "$account_to_id" --arg from "$(jq -r '.from // ""' <<<"$data")" '
      {accountId:$accountId,typeId:$typeId,actionId:$actionId,money:$money,fDate:$fDate,note:$note,collect:$collect,createDate:$createDate}
      + (if $accountToId=="" then {} else {accountToId:($accountToId|tonumber)} end)
      + (if $from=="" then {} else {from:$from} end)
    ')
  precondition=$(ca_sha256_text "$(jq -cS . <<<"$data")")
  request_fingerprint=$(ca_sha256_text "$(jq -cS . <<<"$payload")")
  operation_json=$(jq -cn \
    --argjson flowId "$flow_id" --argjson payload "$payload" --arg precondition "$precondition" --arg requestFingerprint "$request_fingerprint" \
    '{index:0,type:"update",flowId:$flowId,source:{sheet:null,row:null,page:null,externalIdHash:null},preconditionFingerprint:$precondition,payload:$payload,requestFingerprint:$requestFingerprint}')
  binding=$(jq -cn --arg apiBase "$CA_API_BASE" --argjson operationJson "$operation_json" --argjson flowId "$flow_id" \
    --arg account "$CA_ACCOUNT_NAME" --arg category "$CA_CATEGORY_NAME" --arg action "$CA_ACTION_NAME" --arg money "$money" --arg date "$fdate" --arg note "$note" \
    '{schemaVersion:"1",operation:"flow-update",apiBase:$apiBase,inputSha256:null,operations:[$operationJson],preview:{flowId:$flowId,account:$account,category:$category,action:$action,money:$money,date:$date,note:$note,preservesCreateDate:true}}')
  ca_emit_preview "flow-update" "$binding"
}

ca_command_export() {
  shift || true
  ca_parse_query_args "$@"
  if [[ "$CA_APPLY" == "true" ]]; then
    [[ -n "$CA_DIGEST" ]] || ca_die "VALIDATION_ERROR" "--apply requires --digest"
    ca_apply_digest "flow-export" "$CA_DIGEST"
    return $?
  fi
  [[ -n "$CA_EXPORT_NAME" ]] || ca_die "VALIDATION_ERROR" "flows export requires --name"
  [[ -z "$CA_DIGEST" ]] || ca_die "VALIDATION_ERROR" "--digest is only valid with --apply"
  local encoded path operation_json binding request_fingerprint
  ca_require_ready
  ca_require_compatibility
  encoded=$(printf '%s' "$CA_EXPORT_NAME" | jq -sRr @uri)
  path="/screen/makeExcel?excelName=${encoded}"
  request_fingerprint=$(ca_sha256_text "$(jq -cS . <<<"$CA_QUERY_BODY")|$path")
  operation_json=$(jq -cn --arg path "$path" --argjson payload "$CA_QUERY_BODY" --arg requestFingerprint "$request_fingerprint" \
    '{index:0,type:"export",path:$path,source:{sheet:null,row:null,page:null,externalIdHash:null},payload:$payload,requestFingerprint:$requestFingerprint}')
  binding=$(jq -cn --arg apiBase "$CA_API_BASE" --argjson operationJson "$operation_json" --arg name "$CA_EXPORT_NAME" \
    '{schemaVersion:"1",operation:"flow-export",apiBase:$apiBase,inputSha256:null,operations:[$operationJson],preview:{serverFileName:$name,downloadUrl:null,notice:"server-side export only; no direct download URL is promised"}}')
  ca_emit_preview "flow-export" "$binding"
}

ca_validate_import_document() {
  local file="$1"
  jq -e '
    def exact_keys($allowed): ((keys - $allowed) | length) == 0;
    def integer: type=="number" and floor==.;
    def optional_text($key; $limit):
      (has($key)|not) or .[$key] == null or (.[$key]|type=="string" and length <= $limit);
    def date_time:
      type=="string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$");
    . as $document |
    ($document|type=="object" and exact_keys(["schemaVersion","batch","defaults","transactions"])) and
    $document.schemaVersion == "1" and
    ($document.batch|type=="object" and exact_keys(["sourceType","inputSha256","sourceName"])) and
    ($document.batch.sourceType=="pasted-json" or $document.batch.sourceType=="markdown-table" or
      $document.batch.sourceType=="csv" or $document.batch.sourceType=="tsv" or
      $document.batch.sourceType=="xls" or $document.batch.sourceType=="xlsx" or
      $document.batch.sourceType=="xlsm" or $document.batch.sourceType=="pdf" or
      $document.batch.sourceType=="scanned-pdf") and
    ($document.batch.inputSha256|type=="string" and test("^[a-f0-9]{64}$")) and
    ($document.batch.sourceName|type=="string" and length<=120) and
    ($document.defaults|type=="object" and exact_keys(["currency","timeZone"])) and
    ($document.defaults.currency|type=="string" and test("^[A-Z]{3}$")) and
    ($document.defaults.timeZone|type=="string" and length>=1 and length<=80) and
    ($document.transactions|type=="array" and length>0 and length<=500) and
    all($document.transactions[]; . as $transaction |
      ($transaction|type=="object" and exact_keys([
        "source","occurredAt","postedAt","amount","currency","kind","status",
        "sourceAccountHint","targetAccountHint","categoryHint","counterparty",
        "rawDescription","note","parseConfidence","warnings","duplicateStatus",
        "duplicateDecision","ledger"
      ])) and
      ($transaction.source|type=="object" and exact_keys(["sheet","row","page","externalId"])) and
      (($transaction.source.sheet==null) or ($transaction.source.sheet|type=="string")) and
      (($transaction.source.row==null) or ($transaction.source.row|integer and .>=1)) and
      (($transaction.source.page==null) or ($transaction.source.page|integer and .>=1)) and
      (($transaction.source.externalId==null) or ($transaction.source.externalId|type=="string" and length<=200)) and
      ([.source.sheet,.source.row,.source.page,.source.externalId] | any(. != null)) and
      (.occurredAt|date_time) and
      ((has("postedAt")|not) or .postedAt==null or (.postedAt|date_time)) and
      (.amount|type=="string" and test("^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,2})?$")) and
      (.amount|tonumber) > 0 and
      (.currency == $document.defaults.currency) and
      (.kind=="expense" or .kind=="income" or .kind=="transfer" or .kind=="refund") and
      (.status=="posted") and
      optional_text("sourceAccountHint";200) and optional_text("targetAccountHint";200) and
      optional_text("categoryHint";200) and optional_text("counterparty";300) and
      (.rawDescription|type=="string" and length<=1000) and
      (.note|type=="string" and length<=1000) and
      (.parseConfidence|type=="number" and .>=0.90 and .<=1) and
      (.warnings|type=="array" and length==0 and all(.[]; type=="string")) and
      (.duplicateStatus=="none" or .duplicateStatus=="confirmed" or .duplicateStatus=="possible") and
      (.duplicateDecision=="import" or .duplicateDecision=="skip" or .duplicateDecision=="review") and
      (if .duplicateStatus=="none" then .duplicateDecision=="import"
       elif .duplicateStatus=="confirmed" then .duplicateDecision=="skip"
       else (.duplicateDecision=="import" or .duplicateDecision=="skip") end) and
      (.ledger|type=="object" and exact_keys(["accountId","typeId","actionId","expectedHandle","accountToId","collect"])) and
      (.ledger.accountId|integer and .>=1) and
      (.ledger.typeId|integer and .>=1) and
      (.ledger.actionId|integer and .>=1) and
      (.ledger.expectedHandle==0 or .ledger.expectedHandle==1 or .ledger.expectedHandle==2) and
      ((.ledger|has("accountToId")|not) or .ledger.accountToId==null or (.ledger.accountToId|integer and .>=1)) and
      (.ledger.collect|type=="boolean") and
      (if .kind=="expense" then .ledger.expectedHandle==1
       elif .kind=="income" then .ledger.expectedHandle==0
       elif .kind=="transfer" then (.ledger.expectedHandle==2 and (.ledger.accountToId|type=="number") and .ledger.accountToId != .ledger.accountId)
       else ((.ledger.expectedHandle==0 or .ledger.expectedHandle==1) and ((.ledger|has("accountToId")|not) or .ledger.accountToId==null)) end)
    )
  ' "$file" >/dev/null 2>&1
}

ca_command_import_preview() {
  shift || true
  local file="" operations='[]' count index transaction decision external_id external_hash source payload request_fingerprint operation_json
  local expected_handle kind account_id type_id action_id account_to_id create_date occurred_date input_sha summary binding
  while (( $# > 0 )); do
    case "$1" in
      --file) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--file needs a value"; file="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown import preview option: $1" ;;
    esac
  done
  [[ "$file" == /* ]] || ca_die "VALIDATION_ERROR" "--file must be an absolute path"
  [[ -f "$file" ]] || ca_die "VALIDATION_ERROR" "canonical import file does not exist"
  ca_require_ready
  ca_require_compatibility
  ca_validate_import_document "$file" || ca_die "VALIDATION_ERROR" "canonical import file failed schema, confidence, currency, duplicate-decision, or mapping checks"
  ca_fetch_master_data
  count=$(jq '.transactions|length' "$file")
  create_date=$(date '+%Y-%m-%d %H:%M:%S')
  for (( index=0; index<count; index++ )); do
    transaction=$(jq -c --argjson index "$index" '.transactions[$index]' "$file")
    decision=$(jq -r '.duplicateDecision' <<<"$transaction")
    if [[ "$decision" == "skip" ]]; then
      continue
    fi
    kind=$(jq -r '.kind' <<<"$transaction")
    occurred_date=$(jq -r '.occurredAt[0:10]' <<<"$transaction")
    ca_is_date "$occurred_date" || ca_die "VALIDATION_ERROR" "transaction occurredAt contains an invalid calendar date"
    expected_handle=$(jq -r '.ledger.expectedHandle' <<<"$transaction")
    account_id=$(jq -r '.ledger.accountId' <<<"$transaction")
    type_id=$(jq -r '.ledger.typeId' <<<"$transaction")
    action_id=$(jq -r '.ledger.actionId' <<<"$transaction")
    account_to_id=$(jq -r '.ledger.accountToId // empty' <<<"$transaction")
    ca_validate_master_ids "$account_id" "$type_id" "$action_id" "$account_to_id" "$expected_handle"
    external_id=$(jq -r '.source.externalId // empty' <<<"$transaction")
    external_hash=""
    if [[ -n "$external_id" ]]; then external_hash=$(ca_sha256_text "$external_id"); fi
    source=$(jq -cn \
      --argjson source "$(jq -c '.source' <<<"$transaction")" --arg externalIdHash "$external_hash" '
        {sheet:$source.sheet,row:$source.row,page:$source.page,externalIdHash:(if $externalIdHash=="" then null else $externalIdHash end)}')
    payload=$(jq -cn \
      --argjson t "$transaction" --arg createDate "$create_date" '
        {accountId:$t.ledger.accountId,typeId:$t.ledger.typeId,actionId:$t.ledger.actionId,money:$t.amount,fDate:($t.occurredAt[0:10]),note:$t.note,collect:$t.ledger.collect,createDate:$createDate}
        + (if $t.ledger.accountToId then {accountToId:$t.ledger.accountToId} else {} end)')
    request_fingerprint=$(ca_sha256_text "$(jq -cS . <<<"$payload")")
    operation_json=$(jq -cn \
      --argjson index "$index" --argjson source "$source" --argjson payload "$payload" \
      --arg requestFingerprint "$request_fingerprint" --arg kind "$kind" \
      '{index:$index,type:"add",kind:$kind,source:$source,payload:$payload,requestFingerprint:$requestFingerprint}')
    operations=$(jq -cn --argjson current "$operations" --argjson item "$operation_json" '$current + [$item]')
  done
  [[ "$(jq 'length' <<<"$operations")" != "0" ]] || ca_die "VALIDATION_ERROR" "all rows were skipped as confirmed or user-selected duplicates"
  input_sha=$(jq -r '.batch.inputSha256' "$file")
  summary=$(jq -c '
    def cents: capture("^(?<whole>[0-9]+)(?:\\.(?<fraction>[0-9]{1,2}))?$") |
      ((.whole|tonumber)*100 + ((((.fraction // "0") + "0")[0:2])|tonumber));
    def money($cents):
      ($cents / 100 | floor) as $whole |
      ($cents % 100 | tostring) as $fraction |
      ($whole|tostring) + "." + (if ($fraction|length)==1 then "0"+$fraction else $fraction end);
    .transactions as $rows |
    {
      totalRows:($rows|length),
      importRows:([$rows[]|select(.duplicateDecision=="import")]|length),
      skippedDuplicates:([$rows[]|select(.duplicateDecision=="skip")]|length),
      expenseCount:([$rows[]|select(.duplicateDecision=="import" and .kind=="expense")]|length),
      incomeCount:([$rows[]|select(.duplicateDecision=="import" and .kind=="income")]|length),
      transferCount:([$rows[]|select(.duplicateDecision=="import" and .kind=="transfer")]|length),
      refundCount:([$rows[]|select(.duplicateDecision=="import" and .kind=="refund")]|length),
      currency:.defaults.currency,
      expenseTotal:money([$rows[]|select(.duplicateDecision=="import" and .kind=="expense")|.amount|cents]|add // 0),
      incomeTotal:money([$rows[]|select(.duplicateDecision=="import" and .kind=="income")|.amount|cents]|add // 0)
    }
  ' "$file")
  binding=$(jq -cn \
    --arg apiBase "$CA_API_BASE" --arg inputSha256 "$input_sha" --argjson operations "$operations" --argjson summary "$summary" \
    '{schemaVersion:"1",operation:"statement-import",apiBase:$apiBase,inputSha256:$inputSha256,operations:$operations,preview:$summary}')
  ca_emit_preview "statement-import" "$binding"
}

ca_command_import_apply() {
  shift || true
  local digest=""
  while (( $# > 0 )); do
    case "$1" in
      --digest) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--digest needs a value"; digest="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown import apply option: $1" ;;
    esac
  done
  [[ -n "$digest" ]] || ca_die "VALIDATION_ERROR" "import apply requires --digest"
  ca_apply_digest "statement-import" "$digest"
}

ca_command_import_status() {
  shift || true
  local run_id="" file
  while (( $# > 0 )); do
    case "$1" in
      --run-id) [[ $# -ge 2 ]] || ca_die "VALIDATION_ERROR" "--run-id needs a value"; run_id="$2"; shift 2 ;;
      *) ca_die "VALIDATION_ERROR" "unknown import status option: $1" ;;
    esac
  done
  [[ "$run_id" =~ ^[A-Za-z0-9._-]+$ ]] || ca_die "VALIDATION_ERROR" "run ID contains unsafe characters"
  file="$CA_JOURNAL_DIR/${run_id}.json"
  [[ -f "$file" ]] || ca_die "JOURNAL_NOT_FOUND" "no journal matches this run ID" 2
  [[ ! -L "$file" ]] || ca_die "UNSAFE_PATH" "journal must not be a symbolic link"
  chmod 600 "$file" || ca_die "LOCAL_IO_ERROR" "cannot protect journal file"
  jq -c '{ok:true,operation:"import.status",runId:.runId,state:.state,rows:.rows,confirmedAt:.confirmedAt,finishedAt:(.finishedAt // null)}' "$file"
}

DATA_DIR=""
if [[ "${1:-}" == "--data-dir" ]]; then
  [[ $# -ge 2 ]] || ca_die "DATA_DIR_REQUIRED" "--data-dir needs a value"
  DATA_DIR="$2"
  shift 2
fi
[[ -n "$DATA_DIR" ]] || { ca_usage; ca_die "DATA_DIR_REQUIRED" "--data-dir must be the first option"; }
ca_init "$DATA_DIR"

COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { ca_usage; ca_die "VALIDATION_ERROR" "a command is required"; }
shift

case "$COMMAND" in
  doctor) ca_command_doctor "$@" ;;
  config) ca_command_config "$@" ;;
  auth) ca_command_auth "$@" ;;
  accounts)
    [[ "${1:-}" == "list" && $# -eq 1 ]] || ca_die "VALIDATION_ERROR" "use accounts list"
    ca_read_list "accounts.list" "/account/getAccount"
    ;;
  categories)
    [[ "${1:-}" == "list" && $# -eq 1 ]] || ca_die "VALIDATION_ERROR" "use categories list"
    ca_read_list "categories.list" "/type/getType"
    ;;
  actions)
    [[ "${1:-}" == "list" && $# -eq 1 ]] || ca_die "VALIDATION_ERROR" "use actions list"
    ca_read_list "actions.list" "/action/getAction"
    ;;
  flows)
    case "${1:-}" in
      get) ca_command_flows_get "$@" ;;
      query) ca_command_flows_query "$@" ;;
      stats) ca_command_flows_stats "$@" ;;
      export) ca_command_export "$@" ;;
      add) shift; ca_command_add_like "flow-add" "$@" ;;
      update) ca_command_update "$@" ;;
      *) ca_die "VALIDATION_ERROR" "flows action must be get, query, stats, export, add, or update" ;;
    esac
    ;;
  transfers)
    [[ "${1:-}" == "create" ]] || ca_die "VALIDATION_ERROR" "use transfers create"
    shift
    ca_command_add_like "transfer" "$@"
    ;;
  import)
    case "${1:-}" in
      preview) ca_command_import_preview "$@" ;;
      apply) ca_command_import_apply "$@" ;;
      status) ca_command_import_status "$@" ;;
      *) ca_die "VALIDATION_ERROR" "import action must be preview, apply, or status" ;;
    esac
    ;;
  help|-h|--help) ca_usage ;;
  *) ca_usage; ca_die "VALIDATION_ERROR" "unknown command: $COMMAND" ;;
esac
