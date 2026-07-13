---
name: 测试策略设计
short-description: 规划单元、集成与端到端测试的范围、架构和覆盖重点
description: Design test strategies and test plans. Trigger with "how should we test", "test strategy for", "what tests do we need", "test plan", "where are our coverage gaps", "unit vs integration vs e2e", "how do I do TDD here", or when the user needs help with testing approaches, coverage targets, the testing pyramid, or test architecture. (For writing actual test code for a specific file, this gives the plan; pair it with hands-on implementation.)
---

# Testing Strategy

Design effective testing strategies balancing coverage, speed, and maintenance.

## Testing Pyramid

```
        /  E2E  \         Few, slow, high confidence
       / Integration \     Some, medium speed
      /    Unit Tests  \   Many, fast, focused
```

## Strategy by Component Type

- **API endpoints**: Unit tests for business logic, integration tests for HTTP layer, contract tests for consumers
- **Data pipelines**: Input validation, transformation correctness, idempotency tests
- **Frontend**: Component tests, interaction tests, visual regression, accessibility
- **Infrastructure**: Smoke tests, chaos engineering, load tests

## What to Cover

Focus on: business-critical paths, error handling, edge cases, security boundaries, data integrity.

Skip: trivial getters/setters, framework code, one-off scripts.

## Output

Produce a test plan with: what to test, test type for each area, coverage targets, and example test cases. Identify gaps in existing coverage.
