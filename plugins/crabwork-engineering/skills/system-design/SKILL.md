---
name: 系统设计
short-description: 从需求出发设计服务边界、接口、数据模型、缓存与队列
description: Design systems, services, and architectures from requirements — the open-ended "how should we build this" counterpart to the architecture/ADR skill. Trigger with "design a system for", "how should we architect", "system design for", "what's the right architecture for", "how do we scale this", "how should we structure this service", or when the user needs help with API design, data modeling, caching/queue design, or service boundaries. For documenting a single decision between named options as an ADR, prefer the architecture skill.
---

# System Design

Help design systems and evaluate architectural decisions.

## Framework

### 1. Requirements Gathering
- Functional requirements (what it does)
- Non-functional requirements (scale, latency, availability, cost)
- Constraints (team size, timeline, existing tech stack)

### 2. High-Level Design
- Component diagram
- Data flow
- API contracts
- Storage choices

### 3. Deep Dive
- Data model design
- API endpoint design (REST, GraphQL, gRPC)
- Caching strategy
- Queue/event design
- Error handling and retry logic

### 4. Scale and Reliability
- Load estimation
- Horizontal vs. vertical scaling
- Failover and redundancy
- Monitoring and alerting

### 5. Trade-off Analysis
- Every decision has trade-offs. Make them explicit.
- Consider: complexity, cost, team familiarity, time to market, maintainability

## Output

Produce clear, structured design documents with diagrams (ASCII or described), explicit assumptions, and trade-off analysis. Always identify what you'd revisit as the system grows.
