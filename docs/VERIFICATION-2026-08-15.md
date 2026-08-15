# Verification pass — 2026-08-15 (handover doc §4 / §11)

Standing rule: election status and fund confirmations in PROJECT_HANDOVER.md §4/§11
must be re-verified via live search before writing code that depends on them.
This file records the first pass. Re-run before Phase 1 seeding if weeks pass.

## Finding 1 — Elections: still no elected councils; GHMC polls expected Nov–Dec 2026

- Doc §4 claim "no elected corporators/mayors in any of the three bodies" **still holds**.
- New, more specific timeline: state government preparing to hold **GHMC elections in
  November–December 2026**, with CMC and MMC polls to follow. Schedule to be finalised
  only after the Election Commission completes its Special Intensive Revision (SIR) of
  electoral rolls, expected by the **second week of October 2026**.
- Note: the Feb 11, 2026 Telangana municipal elections covered 123 *other* urban local
  bodies (7 corporations, 116 municipalities) — not GHMC/CMC/MMC. One aggregated source
  ambiguously implied GHMC was included; the specific reporting (GHMC polls "likely in
  November") contradicts that. Treat GHMC/CMC/MMC as unelected.
- Election Watch Agent design implication confirmed: "no election scheduled" is the
  steady state, but a real schedule may land ~Oct–Nov 2026 — sooner than the doc implied.

## Finding 2 — NEW: another ward delimitation is proposed (300 → 400 wards)

**This is the significant delta vs. the handover doc.** Reported June 2026 (ETV Bharat):
ahead of the civic polls, a further reorganisation is proposed:

| Body | Current wards (doc's "300") | Proposed |
|---|---|---|
| GHMC (reconstituted) | 150 | **200** |
| Cyberabad MC | 76 | **100** |
| Malkajgiri MC | 74 | **100** |
| **Total** | **300** | **400** |

Zone split per corporation (consistent across sources):
- **GHMC**: Shamshabad, Rajendranagar, Charminar, Golconda, Khairtabad, Secunderabad
- **CMC**: Serilingampally, Kukatpally, Qutbullapur
- **MMC**: Malkajgiri, Uppal, LB Nagar

Status: *proposed*, not yet confirmed by a GO as of this pass. Design implications:
1. The versioned `ward` table (valid_from/valid_to, predecessor_ward_ids) is immediately
   load-bearing, not future-proofing.
2. Do NOT invest heavily in hand-curating per-ward data for the current 300-ward list —
   seed it as version 1, expect a version 2 before elections.
3. Re-verify before building ward lookup (Phase 1) and again before Election Watch Agent.

## Finding 3 — ₹2cr/ward fund: still unconfirmed for the new structure

- The ₹2 crore per-ward resolution (₹1cr discretionary + ₹1cr via district minister)
  remains confirmed only for the **old 150-division GHMC**. No follow-up GO found
  extending it to the 300-ward (or proposed 400-ward) structure.
- Doc §11 stance holds: keep `fund_allocation.status = 'unconfirmed_for_300ward_split'`
  for this scheme.

## Sources

- [ETV Bharat — GHMC, Cyberabad and Malkajgiri set for major ward reorganisation ahead of civic polls](https://www.etvbharat.com/en/state/ghmc-cyberabad-and-malkajgiri-set-for-major-ward-reorganisation-ahead-of-civic-polls-enn26061903806)
- [Deccan Chronicle — Telangana plans Hyderabad civic polls by year-end; GHMC elections likely in November](https://www.deccanchronicle.com/southern-states/telangana/ghmc-elections-likely-in-november-revanth-speeds-up-development-projects-1962251)
- [NewsMeter — GHMC 2.0 explained: 3 municipal corporations, 300 wards, new administrative setup](https://newsmeter.in/top-stories/ghmc-20-explained-3-municipal-corporations-300-wards-new-administrative-setup-762906)
- [Telangana Today — GHMC approves Rs 2 crore per ward for civic development](https://telanganatoday.com/ghmc-approves-rs-2-crore-per-ward-for-civic-development)
- [Wikipedia — 2026 Telangana local elections](https://en.wikipedia.org/wiki/2026_Telangana_local_elections)
- [Wikipedia — Cyberabad Municipal Corporation](https://en.wikipedia.org/wiki/Cyberabad_Municipal_Corporation)
- [Wikipedia — Malkajgiri Municipal Corporation](https://en.wikipedia.org/wiki/Malkajgiri_Municipal_Corporation)
