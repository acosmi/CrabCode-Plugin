# Contract intake: getting the document into the review

There is no email or e-sign connector in this plugin yet — the 腾讯企业邮 (email) and 众律宝 (e-sign) connectors are pending. Contracts arrive by upload or paste.

## Supported sources

1. **Local file** — PDF or DOCX from Desktop or a folder the owner points to. Read PDFs chunked via the `pages` parameter for 10+ page files. Read the whole document, including exhibits and schedules at the back.
2. **Pasted text** — If the owner pastes the contract into chat, work with what's provided. If it looks truncated (cuts off mid-clause, missing signature block), say so and ask for the rest.

## Asking for the contract

If no file or text was provided:

```
"Attach the contract as a PDF or DOCX, or paste the text directly — I'll take it from there."
```

If the contract is sitting in the owner's inbox or in an e-sign service, ask them to download it and attach the file. Do not claim to be able to fetch it.

## After the review

- The redlined DOCX is produced locally. The owner sends it back to the counterparty themselves — there is no email connector. If they want a cover note, draft it in chat for them to copy.
- Once terms are settled, the owner sends the final document for signature via 众律宝, or signs on paper. The skill prepares the document; it never sends or signs.
- Where a notification suffices (e.g., "review done, summary saved"), offer to send a DingTalk/Feishu message via the connected connector — show the message and get approval first.

## What NOT to do

- Do not claim to search email or fetch envelopes from an e-sign service — those connectors don't exist yet.
- Do not send anything on the owner's behalf. Drafts are produced in chat for the owner to send.
- Do not read or modify the original file beyond what the review needs.
