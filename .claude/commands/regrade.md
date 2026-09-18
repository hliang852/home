---
description: Re-grade the garden leave journal and patch the grade strip + a new report entry
---

Re-grade the garden leave journal.

Run the script, which reads every dated entry out of `garden-leave.html`, asks
Claude for a grade card, and patches the page:

```bash
python3 tools/regrade.py --dry-run
```

Show me the proposed grades and verdict from that output. If they look right,
run it for real:

```bash
python3 tools/regrade.py
```

Then confirm the page still renders: the grade strip should show the new marks,
and a new dated report entry should appear at the top of the journal with a red
square on the heatmap for its date. Leave the change uncommitted so I can review
the diff.

If I asked for a specific date (e.g. "regrade as of Dec 1"), pass `--date
YYYY-MM-DD`.
