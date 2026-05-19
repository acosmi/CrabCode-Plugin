---
name: ai-api-dev
description: "Build, debug, and optimize LLM-powered applications in a provider-neutral way. Use this skill when the user is writing code that calls an LLM API (chat completion, tool use, structured output, streaming, batch, embeddings, caching) and wants vendor-agnostic guidance covering API surface choice, prompt design, latency and cost discipline, error handling, and migration between provider SDKs. Trigger when the user mentions an LLM API, a provider SDK such as OpenAI or another compatible client, or an internal LLM gateway, or when the task involves tuning prompt caching, structured output, tool use, or agent loops."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# LLM Application Development

This skill guides building and tuning applications that call an LLM
through a provider's API. The guidance is provider-neutral; pick the
provider that fits the user's existing stack and constraints rather
than hard-coding any single vendor.

## When to Use

Trigger this skill when:

- The user is about to add or modify a code path that talks to an LLM
  API.
- The user mentions prompt caching, streaming, structured output, tool
  use, or agent loops in the context of an API call.
- The user is migrating between provider SDKs or between model
  versions on a single provider.
- The user is debugging latency, cost, rate limit, or reliability
  problems on an LLM API.

Skip this skill when the task is purely conceptual ML or non-API
prompt engineering, or when the user is interacting with a hosted UI
rather than calling an API.

## Before You Start

1. Inspect the project to identify the language, the existing SDK in
   use, and the dominant LLM provider (if any).
2. If the user has not pinned a provider, ask which one to target
   before generating code.
3. Confirm the user wants real API code, not a sample for a different
   provider. Mixing SDK calls across providers in a single file is a
   common bug; avoid it.

## Provider-Neutral Decision Surface

Pick the simplest tier that meets the requirement. Resist reaching for
an agent runtime when a single API call would do.

| Use case                                                   | Tier            | Recommended surface                              |
|------------------------------------------------------------|-----------------|--------------------------------------------------|
| Classification, summarization, extraction, Q&A             | Single call     | One LLM request and response.                    |
| Batch jobs and offline embeddings                          | Single call     | Provider batch endpoint or embedding API.        |
| Multi-step pipelines with code-controlled logic            | Workflow        | LLM API + tool use loop driven by your code.     |
| Custom agent with custom tools                             | Agent           | LLM API + tool use, manual or framework loop.    |
| Provider-hosted persistent agent with workspace and skills | Agent           | Use the provider's managed agent product if any. |

When the project is deployed behind a third-party LLM gateway, defer
to the gateway's documented surface. Some gateways do not implement
the provider's managed agent product; verify before relying on it.

## Defaults

Unless the user has specified otherwise:

- **Streaming**: prefer streaming for any request that might involve
  long input, long output, or a large `max_tokens`. It avoids request
  timeouts and improves perceived latency.
- **Prompt caching**: enable provider-side prompt caching when the
  same prefix is reused across requests, especially long system
  prompts or document context. Confirm cache hit semantics for the
  chosen provider; cache TTLs and minimum sizes differ.
- **Structured output**: prefer the provider's structured output or
  JSON-mode features over ad-hoc parsing of plain text.
- **Retries**: implement bounded retries with jitter for transient
  errors. Treat 429 and 5xx as retryable; do not retry on 4xx that
  signal a malformed request.
- **Timeouts**: set explicit client-side timeouts. Default to a
  conservative value (60-120 seconds for non-streaming, generous for
  streaming) and tighten based on observed latency.

## SDK Discipline

- **One SDK per file.** Do not mix two providers' SDKs in the same
  source file.
- **Never guess SDK shape.** Method names, namespaces, and parameter
  shapes must come from the provider's documentation. When in doubt,
  fetch the SDK README from its canonical source.
- **Avoid OpenAI-shaped wrappers** unless the user has explicitly
  chosen one. Provider-specific features (caching, tool use, system
  prompts, file inputs) often do not round-trip through generic
  shims.
- **Avoid raw HTTP** when an official SDK exists, unless the user
  asks for cURL or REST examples explicitly or the language has no
  official SDK.

## Migration Guidance

When migrating an existing codebase between providers or between
model versions on a single provider:

1. **Inventory** the code paths that touch the API. Look for SDK
   imports, raw HTTP calls, prompt templates, tool definitions, and
   model identifiers.
2. **Define the target surface**: provider, SDK version, model
   identifier, feature flags (caching, thinking, tool use).
3. **Refactor incrementally** behind a feature flag or environment
   switch. Keep the old path operable until the new path passes
   evaluation.
4. **Adjust prompts** for the new model. Cross-provider migrations
   often require system prompt rewrites; same-provider version bumps
   may require behavior recalibration.
5. **Replay representative prompts** through both versions and diff
   the outputs. Pay attention to length, tool selection accuracy,
   and tone.
6. **Retire the old path** only after the new path passes the user's
   acceptance bar.

## Tool Use

Tool use is the foundation of any agent loop. Apply these rules
regardless of provider:

- **Schema clarity**: every tool's input schema must include
  descriptions and constraints. Examples in the schema reduce
  hallucinated arguments.
- **Idempotency annotations**: mark read-only and idempotent tools
  when the provider supports it. Routers and agents use the
  annotations to plan execution.
- **Error surface**: actionable error messages with concrete next
  steps. Do not return raw stack traces to the LLM.
- **Pagination and filtering**: prefer narrow result shapes with
  pagination over fat dumps. Long tool outputs inflate context.

## Reliability

- **Retry policy**: bounded retries with exponential backoff and
  jitter for 429 and 5xx.
- **Rate limit handling**: respect the provider's `Retry-After`
  header where present. Avoid client-side throttle loops that
  thrash.
- **Streaming reconnection**: when a streaming response disconnects,
  reissue from the last completed segment if the provider supports
  resumable streams; otherwise restart the request.
- **Observability**: log request and response sizes, latency, and
  cache hit rates. Do not log raw user data unless the deployment
  context allows it.

## Cost Discipline

- **Cache aggressively** when a long static prefix appears across
  requests.
- **Truncate context** that does not influence the answer. Long
  irrelevant context wastes tokens and degrades quality.
- **Pick the smallest competent model** for each step. Do not route
  every step through the largest model.
- **Batch when possible** for offline workloads.

## Reference Material

For SDK-specific details, fetch documentation from the provider's
canonical source:

- The provider's developer portal or documentation site.
- The provider's official SDK README on its source-host page.
- Any internal LLM gateway documentation the user has set up.

Do not infer SDK shape across languages or providers. When uncertain,
ask the user for the specific SDK version in use and consult its
documentation before generating code.

## Decision Gate (For Maintainers)

The original upstream skill targeted a single provider's SDK. This
CrabCode rewrite is provider-neutral by default. If the CrabCode
maintainers later choose to specialize this skill toward a specific
provider or a CrabCode-hosted gateway, replace the relevant
provider-neutral sections with vendor-specific guidance and document
the decision in the plugin's `README.md`.
