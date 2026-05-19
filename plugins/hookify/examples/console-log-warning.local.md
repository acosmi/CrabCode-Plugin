---
name: warn-console-log
enabled: true
event: file
pattern: console\.log\(
action: warn
---

console.log detected.

You're adding a console.log statement. Consider:
- Is this for debugging or should it use a structured logger?
- Will this ship to production?
- Should a logging library be used instead?
