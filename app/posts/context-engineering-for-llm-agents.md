---
title: "Context Engineering for LLM Agents"
date: "2026-03-24"
excerpt: "The most important skill in building reliable LLM agents isn't prompt writing — it's context engineering: deciding what information to put in the window, in what form, and when."
---

## What Is Context Engineering?

Every LLM call receives a context window. What goes into that window — system instructions, conversation history, retrieved documents, tool outputs, examples — determines whether the model reasons correctly or hallucinates confidently.

Prompt engineering gets most of the attention, but it is a subset of a larger discipline: **context engineering**. While prompt engineering focuses on the words you write in a single instruction, context engineering governs the entire information environment presented to the model at inference time.

For agents that make multi-step decisions, call tools, and operate over long tasks, context engineering is the primary lever of reliability.

---

## The Four Dimensions of Context

A useful mental model breaks context into four dimensions:

1. **Content** — What information is present? Instructions, examples, facts, tool results.
2. **Structure** — How is information arranged? XML tags, JSON, prose, headers.
3. **Recency** — How fresh is the information? Stale retrieved chunks mislead; the model trusts what it sees.
4. **Volume** — How much is present? Too little leaves gaps; too much drowns signal in noise.

Optimising any one dimension without the others produces fragile agents. A well-structured prompt stuffed with irrelevant retrieved text will still fail.

---

## Practical Pattern: Layered System Prompts

A layered system prompt separates concerns into distinct, independently maintainable sections. This makes the agent easier to reason about and modify.

```xml
<system>
  <role>
    You are a code-review agent. Your job is to review pull requests and
    surface bugs, security issues, and style violations.
  </role>

  <constraints>
    - Never approve a PR that contains hardcoded secrets.
    - Always check for SQL injection in any database-touching code.
    - Output only structured JSON — no prose summaries.
  </constraints>

  <output_format>
    {
      "verdict": "approve" | "request_changes",
      "issues": [{ "severity": "high|medium|low", "line": number, "message": string }]
    }
  </output_format>
</system>
```

The agent receives this template every call. Individual sections can be swapped — for example, substituting `output_format` when downstream consumers change — without touching the rest of the context.

---

## Practical Pattern: Dynamic Context Assembly

Static prompts break when agents operate over variable inputs. The solution is **dynamic context assembly**: building the context programmatically at runtime based on the current task state.

```typescript
async function buildAgentContext(task: ReviewTask): Promise<string> {
  const sections: string[] = [];

  // 1. Role and constraints are always present
  sections.push(SYSTEM_ROLE);
  sections.push(SYSTEM_CONSTRAINTS);

  // 2. Retrieve only the files relevant to this diff
  const relevantDocs = await retriever.search(task.diff, { topK: 5 });
  if (relevantDocs.length > 0) {
    sections.push(formatRetrievedDocs(relevantDocs));
  }

  // 3. Include recent tool call history (last 3 turns only)
  const recentHistory = task.toolHistory.slice(-3);
  if (recentHistory.length > 0) {
    sections.push(formatToolHistory(recentHistory));
  }

  // 4. The actual task
  sections.push(`<task>\n${task.diff}\n</task>`);

  return sections.join("\n\n");
}
```

The key insight is that "what should be in the context" is a code problem, not a prompt problem. You have the full power of your programming language to filter, rank, and format information before it reaches the model.

---

## The Context Budget

Frontier models have large context windows, but size is not the bottleneck — **attention dilution** is. Research consistently shows that models pay less attention to information buried in the middle of long contexts (the "lost in the middle" effect). Practical budget recommendations:

| Section | Recommended budget |
|---|---|
| System instructions | ≤ 800 tokens |
| Retrieved documents | ≤ 2 000 tokens (3–5 chunks max) |
| Tool call history | ≤ 1 000 tokens (last 3–5 turns) |
| Current task | As needed |

These are starting points, not rules. Profile your agent's failure modes first; then tighten budgets where irrelevant tokens crowd out relevant ones.

---

## Measuring Context Quality

Context engineering is an empirical discipline. You cannot reason your way to the right context — you need to measure.

A minimal eval harness for context quality:

```python
import anthropic

def eval_context(context: str, question: str, expected: str) -> dict:
    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=512,
        messages=[
            {"role": "user", "content": f"{context}\n\n{question}"}
        ]
    )
    answer = message.content[0].text
    passed = expected.lower() in answer.lower()
    return {"passed": passed, "answer": answer, "tokens": message.usage.input_tokens}

# Run against a golden dataset of (context, question, expected_answer) triples
results = [eval_context(c, q, e) for c, q, e in golden_dataset]
pass_rate = sum(r["passed"] for r in results) / len(results)
avg_tokens = sum(r["tokens"] for r in results) / len(results)

print(f"Pass rate: {pass_rate:.1%} | Avg input tokens: {avg_tokens:.0f}")
```

Track `pass_rate` and `avg_tokens` together. An optimisation that improves accuracy by compressing context is better than one that improves accuracy by adding more tokens.

---

## Summary

Context engineering is the practice of deliberately shaping what an LLM sees. For production agents, it is more impactful than any individual prompt tweak. Start with a layered system prompt, assemble context dynamically at runtime, respect attention budgets, and measure quality empirically. The model does the reasoning; your job is to give it the right information to reason about.
