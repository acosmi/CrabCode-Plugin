#!/usr/bin/env python3
"""Small JSON-Schema subset validator used by CrabLaw-CN without dependencies."""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any


def _type_matches(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "null":
        return value is None
    return True


def validate_instance(instance: Any, schema: dict[str, Any], location: str = "$") -> list[str]:
    errors: list[str] = []

    if "const" in schema and instance != schema["const"]:
        errors.append(f"{location}: expected constant {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{location}: value {instance!r} is not in the allowed enum")

    expected_type = schema.get("type")
    if isinstance(expected_type, str) and not _type_matches(instance, expected_type):
        return [f"{location}: expected {expected_type}, got {type(instance).__name__}"]
    if isinstance(expected_type, list) and not any(_type_matches(instance, item) for item in expected_type):
        return [f"{location}: value does not match any allowed type {expected_type}"]

    if isinstance(instance, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in instance:
                errors.append(f"{location}: missing required property {key!r}")
        properties = schema.get("properties", {})
        for key, value in instance.items():
            child_schema = properties.get(key)
            if isinstance(child_schema, dict):
                errors.extend(validate_instance(value, child_schema, f"{location}.{key}"))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{location}: unexpected property {key!r}")

    if isinstance(instance, list):
        if "minItems" in schema and len(instance) < schema["minItems"]:
            errors.append(f"{location}: expected at least {schema['minItems']} item(s)")
        if "maxItems" in schema and len(instance) > schema["maxItems"]:
            errors.append(f"{location}: expected at most {schema['maxItems']} item(s)")
        if schema.get("uniqueItems"):
            serialized = [json.dumps(item, ensure_ascii=False, sort_keys=True) for item in instance]
            if len(serialized) != len(set(serialized)):
                errors.append(f"{location}: array items must be unique")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(instance):
                errors.extend(validate_instance(item, item_schema, f"{location}[{index}]"))
        contains_schema = schema.get("contains")
        if isinstance(contains_schema, dict):
            match_count = sum(
                not validate_instance(item, contains_schema, f"{location}[{index}]")
                for index, item in enumerate(instance)
            )
            minimum_contains = schema.get("minContains", 1)
            maximum_contains = schema.get("maxContains")
            if match_count < minimum_contains:
                errors.append(
                    f"{location}: expected at least {minimum_contains} item(s) matching contains, got {match_count}"
                )
            if maximum_contains is not None and match_count > maximum_contains:
                errors.append(
                    f"{location}: expected at most {maximum_contains} item(s) matching contains, got {match_count}"
                )

    if isinstance(instance, str):
        if "minLength" in schema and len(instance) < schema["minLength"]:
            errors.append(f"{location}: string is shorter than {schema['minLength']}")
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{location}: string is longer than {schema['maxLength']}")
        if "pattern" in schema and re.search(schema["pattern"], instance) is None:
            errors.append(f"{location}: string does not match pattern {schema['pattern']!r}")
        if schema.get("format") == "date":
            try:
                dt.date.fromisoformat(instance)
            except ValueError:
                errors.append(f"{location}: invalid ISO date")
        if schema.get("format") == "date-time":
            try:
                dt.datetime.fromisoformat(instance.replace("Z", "+00:00"))
            except ValueError:
                errors.append(f"{location}: invalid ISO date-time")

    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{location}: number is below minimum {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{location}: number is above maximum {schema['maximum']}")

    for child in schema.get("allOf", []):
        errors.extend(validate_instance(instance, child, location))

    if "anyOf" in schema:
        candidates = [validate_instance(instance, child, location) for child in schema["anyOf"]]
        if all(candidate for candidate in candidates):
            errors.append(f"{location}: value does not match any anyOf branch")

    if "oneOf" in schema:
        matches = sum(not validate_instance(instance, child, location) for child in schema["oneOf"])
        if matches != 1:
            errors.append(f"{location}: value must match exactly one oneOf branch, matched {matches}")

    condition = schema.get("if")
    if isinstance(condition, dict) and not validate_instance(instance, condition, location):
        then_schema = schema.get("then")
        if isinstance(then_schema, dict):
            errors.extend(validate_instance(instance, then_schema, location))
    elif isinstance(condition, dict):
        else_schema = schema.get("else")
        if isinstance(else_schema, dict):
            errors.extend(validate_instance(instance, else_schema, location))

    return errors
