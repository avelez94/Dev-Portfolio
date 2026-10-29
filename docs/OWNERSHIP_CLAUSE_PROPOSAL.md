# Proposed revision: contract clause 4 (ownership)

Status: **proposal only. Not applied.** No contract wording has changed.

## Current clause (signing page, and now the PDFs for current terms)

> **4. Intellectual property**
> Full ownership of all deliverables transfers to Client upon receipt of final payment in full. Until final payment is received, all work remains the property of Alante Velez. Alante Velez retains the right to display completed work in portfolio and case studies.

Source: `src/lib/contract-document.ts`, clause 4.

## Approved policy (published FAQ)

> Ownership of the completed website and custom work created for your project transfers to you once final payment is received and handoff is complete. Until then, that work remains my property. Third party software, fonts, images, and services remain subject to their respective licenses and terms.

## Proposed clause (follows the approved policy only)

> **4. Ownership and intellectual property**
> Ownership of the completed website and the custom work created for this project transfers to Client once final payment is received and handoff is complete. Until then, that work remains the property of Alante Velez. Third party software, fonts, images, plugins, and services used in the project remain subject to their respective licenses and terms. Alante Velez retains the right to display completed work in portfolio and case studies.

The last sentence is the existing portfolio sentence, kept unchanged. "Plugins" is added to the list of third party items as an example; remove it if you want the list to match the FAQ word for word.

## Differences that need your decision

1. **What transfers.** Current: "all deliverables". Proposed: "the completed website and the custom work created for this project". This narrows the transfer so licensed third party items aren't promised as Client property. *Matches the approved policy.*
2. **When it transfers.** Current: on final payment. Proposed: on final payment **and** completed handoff. *Matches the approved policy.* Note: the payment clause already places the balance "at delivery, before public launch or final handoff", so payment normally comes first and handoff closes it out.
3. **Third party items.** The current contract says nothing about them; the warranty clause only says work won't infringe third party rights. Proposed adds the licensing sentence. *Matches the approved policy.*
4. **Portfolio rights.** Not mentioned in the FAQ. The proposal keeps the existing sentence unchanged. **Flag:** keep, narrow (for example "with Client's permission for unreleased work"), or remove?
5. **Reusable code. No existing clause.** Neither the contract nor the FAQ addresses tools, components, or code you reuse across projects. Under the current "all deliverables" wording a client could argue those transfer too. The approved policy ("custom work created for your project") implies they don't, but doesn't say so. **Flag for your review.** Possible sentence, *not part of the proposal unless you approve it*:
   > Alante Velez keeps ownership of general tools, code, and components that existed before this project or are not specific to it, and grants Client a permanent, royalty free license to use them as part of the website.
6. **Dashes in clause 6.** The current clause 6 says "third-party services". It has a dash, but it's legal text, so it wasn't changed in the visual update. It could be changed to "third party services" in the same revision.

## How it would be applied once approved

A wording change in the contract has to apply only to contracts issued after it, never to ones already sent or signed:

1. Add a new terms version in `src/lib/terms.ts` (for example `2026-11-ownership`), and make clause 4 in `src/lib/contract-document.ts` depend on it. Contracts on `2026-10-standard-rate` keep today's wording. `usesCurrentTerms()` currently checks for one exact version, so it must be changed to accept both `2026-10-standard-rate` and the new version; otherwise October documents would fall back to the pre October wording.
2. Because the signing page, the signed PDF, and the admin download all read from `contract-document.ts`, they change together for new contracts only.
3. Update the admin clause summary (Docs, contract form) to describe the new clause.
4. Proposals and SOWs reference "the accepted Proposal and Statement of Work" in the entire agreement clause, but neither has its own ownership wording, so neither needs to change.
