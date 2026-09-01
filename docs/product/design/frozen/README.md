# Frozen Authenticated Workspace Design

Status:
FROZEN IMPLEMENTATION REFERENCE

Source archive:
Variants pending review (16).zip

Source archive SHA-256:
4AB70953933E4BD64EBB4D18EDDC7FB46A33AD879A02D063858BB8AEC81D5131

Import date:
2026-09-01

Authority notes:

- PRODUCT.md and actual supported product behaviour remain authoritative for
  functionality.
- These frozen artefacts define the approved authenticated-workspace visual and
  semantic direction.
- The implementation specification consolidates Boards A-D for engineering.
- Functional/data defects must not be visually disguised.
- Changing a frozen artefact requires an explicit new design ruling.
- Intermediate/rejected variants were deliberately excluded.

## Canonical artefacts

| Canonical file | Original archive file | SHA-256 | Status | Notes |
| --- | --- | --- | --- | --- |
| board-a-similarity-evidence-system.html | Board A - Similarity Evidence System.dc.html | A828CEC3226FE3AEC61E32AD6339F56F2630AB5DFAF5DDC1893F62E11E906C0E | FROZEN | Byte-identical to archive source. |
| board-b-lecturer-review-detail.html | Board B - Lecturer Review Detail.dc.html | 227BCDCFD1B3FF164DCCCE0E65C830169AB4C342F11C904A7FC24367DD1F9D63 | FROZEN | Byte-identical to archive source. |
| board-c-failure-absence-states.html | Board C - Failure and Absence States.dc.html | 77539B8C8D993C06D960E76BD0E644789A485A81E2B6F5A05BABC2A949D4A224 | FROZEN | Byte-identical to archive source. |
| board-d-repeated-records-primitives.html | Board D - Repeated Records and Primitives.dc.html | CFA727745C1413263052D904F1513AF61C856C1490AA587234DA29152F39EFF7 | FROZEN | Byte-identical to archive source. |
| authenticated-workspace-implementation-specification.html | Authenticated Workspace Implementation Specification.dc.html | 2D39841954A93C9AC8F8C2E68376C429C899C5AC45F78CBA841B9CFBB87101A2 | FROZEN | Canonical copy of the REVISED specification. The archive original is SUPERSEDED; see "Post-archive design ruling" below. |
| authenticated-workspace-audit-v2.html | Authenticated Product Visual Audit v2.dc.html | AE5035BF8D74CBCFEC658EF61F661DF99835C6BD2309A46177258453BE9B9F36 | FROZEN | Byte-identical to archive source. Pixel-validated audit, revised against real captures. |
| authenticated-capture-manifest.md | uploads/authenticated-captures/manifest.md | 67A199F5077366297122B1A6FF051069072E8765ED15D1FFCB8961B800048AB5 | FROZEN | Byte-identical to archive source. |
| authenticated-capture-manifest.json | uploads/authenticated-captures/manifest.json | 886336EC513720AED06021A6424F08D00F02A25EE12AF60DAF91DC97781779AF | FROZEN | Byte-identical to archive source. |

## Post-archive design ruling

- Date: 2026-09-01
- Affected artefact: Authenticated Workspace Implementation Specification
- Affected rule: P3 only
- Reason: global radius/shape equations would conflict with real application
  components where pills/radii are shared by unrelated semantic families
- Status: old P3 SUPERSEDED
- Replacement (scoped P3 text now in the canonical specification):

  "Shape and context help identify semantic families before colour identifies
  the value. Within authenticated record and state primitives, similarity
  classification, workflow status, operational state, and actions should use
  consistently distinguishable treatments so the taxonomy remains understandable
  in greyscale and for colour-blind users. This is not a global radius or shape
  rule: unrelated tags, filters, inputs, buttons, and other components may share
  shapes or radii where their context already makes their purpose clear."

- Superseded original P3 text (for the record):

  "Shape identifies the family before colour identifies the value — 5px chip =
  similarity classification. Fully-rounded pill = workflow status. Edge rule =
  system condition. 6px control = action. The taxonomy therefore survives
  greyscale, colour blindness, and a developer who does not know the semantics."

Original archive specification SHA-256:
B33B7FB3DE02D9CD42A4C81CB41DE59641A5E145875DE6DAC5E82443186A4B89

Revised canonical specification SHA-256:
2D39841954A93C9AC8F8C2E68376C429C899C5AC45F78CBA841B9CFBB87101A2

Revision applied after archive export under explicit design ruling:
P3 shape semantics narrowed from an absolute equation to a scoped
authenticated-record/state principle. No other specification content changed.

## Capture evidence status

- audit v2: FROZEN
- manifest.md: FROZEN
- manifest.json: FROZEN
- authenticated capture PNG pack: FROZEN
- authenticated capture PNG count: 28
- unique PNG content hashes: 28
- archive, manifests, and protected design-worktree filename sets: identical
- ZIP ↔ design-worktree ↔ canonical PNG bytes: verified identical for all 28

The authenticated capture pack is complete. A read-only forensic recount on
2026-09-01 established that the previously recorded count of 27 was an archive
inventory counting error. The source archive actually contains 28 authenticated
capture PNGs, matching both manifests and audit v2.

No capture was missing and no replacement capture was generated.

The canonical pack lives in `authenticated-captures/` beside this README,
copied byte-identically from the source archive. Its per-file hashes are
recorded in `authenticated-capture-sha256.txt`, a derived integrity record
generated during canonicalisation on 2026-09-01 — it is not an archive-source
artefact.

## Capture-count correction

- Date: 2026-09-01
- Previous README statement: archive contained 27 authenticated capture PNGs
- Status: CORRECTED
- Correct count: 28
- Cause: manual grouping/counting error during the initial archive inventory
- Evidence:
  - manifest.md = 28 records
  - manifest.json = 28 records
  - ZIP = 28 PNGs / 28 unique hashes
  - protected design worktree = same 28 filenames and hashes
  - audit v2 = 28 physical capture files

This correction changes provenance metadata only. It does not revise any Board
A-D design decision or authenticated-workspace implementation rule.

Audit v2 provenance note: audit v2 contains a non-substantive counting-unit
inconsistency in Part 3: 12 audit table rows represent 15 physical PNG files
because three rows cover desktop/mobile pairs. Its header and named unopened
set resolve to 15 inspected files + 13 unopened files = 28 physical captures.
The canonical manifests and capture pack define the physical-file inventory.
The audit itself remains hash-frozen and unedited; this note is not a new
design ruling.

## Excluded from this import

Deliberately excluded, with reasons:

- Authenticated Product Visual Audit.dc.html — superseded by audit v2.
- Board 2a / 2b / 2c, Final Candidate - Refined 2b, Landing Visual Direction
  Review — landing-track artefacts; the landing direction is frozen separately.
- Finishing Alternatives + Supersessions, Typography Control Test —
  intermediate process documents.
- .thumbnail, github.md, support.js — platform export residue.
- uploads/variant_shots-*.png, uploads/variant-2-*.png — landing screenshots.
