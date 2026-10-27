# Context Reference Retrieval Test

## Purpose

This test determines whether ChatGPT can retrieve source-specific facts from a separate conversation when the destination prompt provides a reference. A fluent or plausible answer is not evidence of retrieval.

## Procedure

1. In a source conversation, add a few non-sensitive, distinctive facts that are not in the destination Project instructions or general memory. For example, use a unique test code, an unusual decision, and one unresolved question. Record the exact facts privately as the answer key.
2. In three fresh destination conversations with equivalent access and no prior test context, provide the same request using these variants:
   - Title only.
   - Title plus conversation ID.
   - Title plus URL.
3. Ask the destination to repeat the unique test code, the decision, and the unresolved question. Require it to say explicitly if it cannot open the source.
4. Compare the reply against the answer key. Count exact source-specific details, contradictions, and unsupported claims. Do not count generic resume/project advice or details already present in Project memory as source retrieval.
5. Repeat each variant in a fresh destination at least three times if comparing reliability. Do not send sensitive production conversations as test material.

## Result in This Environment

**Not run against an authenticated ChatGPT account.** The available ChatGPT browser session is logged out, and no source conversation or answer key is available here. The local browser fixtures verify only that title, URL, ID, and the unsent request are formatted and routed correctly. They do not prove that destination ChatGPT can open or retrieve another conversation. No live test message was submitted.

Therefore, retrieval accuracy for title-only, title-plus-ID, and title-plus-URL is **unverified**. Treat the source reference as a navigation hint, not as transferred context. The prompt explicitly asks ChatGPT not to fabricate details when the source is inaccessible.

## Decision on Richer Transfer

If the live test cannot reliably recover the unique facts, reference-only handoff is insufficient for continuity. A richer user-reviewed context transfer would then be needed. That should be a separate follow-up with explicit privacy controls; this implementation intentionally does not scrape or copy conversation history.
