# Luna 5.6 — MCP polish (main)

**Goals:** Documentation and pure URL helpers only. No new network mutations.

**Tasks:**

1. Add **`unf_placement_forms_url`** (pure): build URLs for placement-related actions from FINDINGS — at minimum `forms.unfBVIBVPlacement`, `forms.unfBVIBVAutoPlacementUpdate`, `forms.unfBVIBVDesignationU` / `forms.unfIBVDesignationU` (pick names from FINDINGS.md API table). Optional `target` enum in schema. No fetch.

2. **README.md** — Add tool row; update intro line to mention 17 tools; mark roadmap **Reports placement** as URL helpers only (read FINDINGS, no submit).

3. **package.json** — description one line mentioning Form 1000 optimiser + placement URLs.

4. **pure-smoke.mjs** — Assert new tool exists and returns hk.unfranchise.com URL without network.

5. `npm test` exit 0.

Do not change bill-ship live fixtures, optimiser logic, or capture scripts except if a one-line comment is needed.
