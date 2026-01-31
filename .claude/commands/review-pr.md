---
name: review-pr
description: |
  Comprehensive PR review using specialized agents. Runs multiple review aspects
  including code quality, test coverage, error handling, type design, comments, and
  code simplification.

  Usage: /review-pr [review-aspects]
  Aspects: comments, tests, errors, types, code, simplify, all (default)

  Examples:
  - "/review-pr" -> runs all applicable reviews
  - "/review-pr tests errors" -> reviews test coverage and error handling only
  - "/review-pr code" -> general code review only
  - "/review-pr simplify" -> code simplification pass only
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - TodoWrite
  - Task
user-invokable: true
---

# Comprehensive PR Review Command

You coordinate a comprehensive pull request review using specialized agents. Each agent focuses on a specific aspect of code quality.

## Review Workflow

### Step 1: Determine Review Scope

```bash
# Check what files have changed
git diff --name-only

# Check if a PR exists for this branch
gh pr view --json number,title,url,state 2>/dev/null || echo "No PR found"

# See the full diff
git diff
```

Parse the user's arguments to determine which review aspects to run. Default is `all`.

### Step 2: Available Review Aspects

| Aspect | Agent | When Applicable |
|--------|-------|-----------------|
| `code` | code-reviewer | Always (general quality review) |
| `tests` | pr-test-analyzer | When test files are changed or new functionality added |
| `comments` | comment-analyzer | When comments or documentation are added/modified |
| `errors` | silent-failure-hunter | When error handling code is changed |
| `types` | type-design-analyzer | When new types are added or existing types modified |
| `simplify` | code-simplifier | After all other reviews pass (final polish) |

### Step 3: Identify Applicable Reviews

Automatically determine which reviews apply based on changed files:

- **Always applicable**: `code-reviewer` (general quality)
- **If test files changed or new features added**: `pr-test-analyzer`
- **If comments/docs added or modified**: `comment-analyzer`
- **If error handling changed (try-catch, .catch, error callbacks)**: `silent-failure-hunter`
- **If TypeScript types/interfaces added or modified**: `type-design-analyzer`
- **After all reviews pass**: `code-simplifier` (final polish)

### Step 4: Launch Review Agents

For each applicable review aspect, use the Task tool to launch the corresponding agent skill:

1. Read the changed files to understand the scope
2. Launch each agent with context about what to review
3. Collect results from each agent

**Run agents sequentially by default** for easier comprehension. Note which aspects were run and which were skipped (and why).

### Step 5: Aggregate Results

Combine findings from all agents into a unified report:

1. **Critical Issues** (must fix before merge) — from all agents, severity 90-100
2. **Important Issues** (should fix) — severity 80-89
3. **Suggestions** (nice to have) — lower severity findings
4. **Positive Observations** — what's done well across all aspects

### Step 6: Summary

Provide a clear summary including:
- Which review aspects were run
- Total issues found by severity
- Top priority items to address
- Overall assessment of PR readiness

## Usage Examples

```
# Full review (default)
/review-pr

# Specific aspects
/review-pr tests errors
/review-pr comments
/review-pr simplify

# Just code quality
/review-pr code
```

## Tips

- **Run early** — before creating the PR, not after
- **Focus on changes** — agents analyze git diff by default
- **Address critical first** — fix high-priority issues before lower priority
- **Re-run after fixes** — verify issues are resolved
- **Use specific reviews** — target specific aspects when you know the concern
