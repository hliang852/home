#!/usr/bin/env python3
"""
regrade.py — re-grade the garden leave journal and patch garden-leave.html.

The heatmap is self-maintaining (heatmap.js reads the entry dates), but the
grades, the verdict and the summary bullets are judgement calls, so they need
a model. This script does one pass:

    1. read every dated journal entry out of garden-leave.html
    2. ask Claude for a grade card + three bullets, as structured output
    3. patch the grade strip in place, and insert a NEW dated report entry

Old report entries are never touched — each one keeps its own red square on
the heatmap, so the quarterly reports build up a history the same way the
book-list squares do.

Usage
-----
    python3 tools/regrade.py --dry-run     # print the new grades, touch nothing
    python3 tools/regrade.py               # patch the HTML, leave it uncommitted
    python3 tools/regrade.py --commit      # ... and git-commit the result

Credentials: the SDK resolves these itself. Either export ANTHROPIC_API_KEY or
run `ant auth login` once — the latter is preferred for the scheduled job so no
secret has to live in the launchd plist.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import shutil
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PAGE = REPO / "garden-leave.html"

MODEL = "claude-opus-5"

# where a freshly generated report entry gets spliced in
INSERT_MARKER = "<!-- REGRADE:INSERT-REPORTS-BELOW -->"

# the four sub-grades, keyed by the exact label already in the HTML so a
# reordered card row can never get the wrong grade attached to it
CARDS = [
    ("building", "Building &amp; shipping"),
    ("reading", "Reading &amp; thinking"),
    ("health", "Health &amp; admin"),
    ("next_steps", "Deciding what's next"),
]

MONTHS = "january february march april may june july august september october november december".split()
MONTH_ABBR = [m[:3].title() for m in MONTHS]


# --------------------------------------------------------------------------
# 1. read the journal out of the page
# --------------------------------------------------------------------------

@dataclass
class Entry:
    date: dt.date
    label: str
    text: str


def parse_when(text: str) -> dt.date | None:
    """Mirror of parseWhen() in heatmap.js — same accepted date shapes."""
    m = re.search(r"([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})", text or "")
    if not m:
        return None
    key = m.group(1).lower()
    month = next((i for i, name in enumerate(MONTHS) if name.startswith(key)), None)
    if month is None:
        return None
    try:
        return dt.date(int(m.group(3)), month + 1, int(m.group(2)))
    except ValueError:
        return None


class EntryExtractor(HTMLParser):
    """Pulls out every div.entry. Commented-out templates land in
    handle_comment and are ignored, which is why this is a real parser and
    not a regex."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.entries: list[dict] = []
        self._depth = 0          # div depth inside the current entry
        self._cur: dict | None = None
        self._in_when = 0        # div depth at which .when opened

    def handle_starttag(self, tag, attrs):
        if tag != "div":
            if self._cur and tag == "br":
                self._cur["text"].append("\n")
            return
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if self._cur is None:
            if "entry" in classes:
                self._cur = {"attrs": a, "when": [], "text": []}
                self._depth = 1
            return
        self._depth += 1
        if "when" in classes and not self._in_when:
            self._in_when = self._depth

    def handle_endtag(self, tag):
        if tag != "div" or self._cur is None:
            return
        if self._in_when == self._depth:
            self._in_when = 0
        self._depth -= 1
        if self._depth == 0:
            self.entries.append(self._cur)
            self._cur = None

    def handle_data(self, data):
        if self._cur is None:
            return
        target = "when" if self._in_when else "text"
        self._cur[target].append(data)


def read_entries(html: str) -> list[Entry]:
    p = EntryExtractor()
    p.feed(html)
    out: list[Entry] = []
    for raw in p.entries:
        label = " ".join("".join(raw["when"]).split())
        # the rolling book list and the previous reports are not journal entries
        if re.match(r"^\s*books i read", label, re.I):
            continue
        if raw["attrs"].get("data-hm") == "report":
            continue
        date = parse_when(label)
        if not date:
            continue
        text = re.sub(r"[ \t]+", " ", "".join(raw["text"]))
        text = re.sub(r"\n\s*\n+", "\n", text).strip()
        out.append(Entry(date=date, label=label, text=text))
    out.sort(key=lambda e: e.date)
    return out


# --------------------------------------------------------------------------
# 2. ask for the grades
# --------------------------------------------------------------------------

RUBRIC = """\
You are grading a garden-leave journal — a personal record kept by someone \
between jobs, to hold themselves accountable for how they spend the time.

Produce a report card with four sub-grades and one overall grade, plus three \
summary bullets. Grade the substance of what was actually done and thought, \
not the quality of the writing.

The four dimensions, in this order:
  1. Building & shipping — projects started, shipped, re-architected; \
technical judgement shown.
  2. Reading & thinking — depth and continuity of intellectual work; whether \
ideas develop across entries or merely accumulate.
  3. Health & admin — physical health, therapy, finances, logistics, \
relationships; the unglamorous groundwork.
  4. Deciding what's next — progress toward resolving what the leave was for. \
Interviews, applications, offers, a chosen direction.

Grading standards — apply them honestly:
  - Use the full range. A+ through F, with +/- modifiers. "A−" style minus \
signs must use the Unicode minus U+2212, not a hyphen.
  - A straight-A card is a failure of grading. If a dimension is genuinely \
weak, say so with the grade; the credibility of the high grades depends on it.
  - Reward evidence, not intention. "Planning to start X" is not an \
accomplishment; "shipped X" is.
  - The overall grade is a judgement, not an average.

The verdict is one sentence, at most 35 words: what stands out, and the single \
thing holding the grade down.

Each of the three bullets is 30–50 words and starts with a short bold claim \
followed by an em dash, then the evidence. Between them they must cover both \
concrete output and intellectual work. Be specific — name projects, books, \
places, numbers. Do not invent anything not in the entries.
"""


def build_prompt(entries: list[Entry]) -> str:
    chunks = [
        f"=== {e.date:%B %-d %Y} ===\n{e.text}" for e in entries
    ]
    return (
        f"Here are all {len(entries)} journal entries, oldest first.\n\n"
        + "\n\n".join(chunks)
        + "\n\nGrade this journal now."
    )


def get_grades(entries: list[Entry]):
    """Returns the validated structured output. Imports are local so that
    --dry-run --offline style inspection works without the SDK installed."""
    import anthropic
    from pydantic import BaseModel, Field

    class Report(BaseModel):
        overall: str = Field(description="Overall letter grade, e.g. 'A−'")
        building: str = Field(description="Grade for Building & shipping")
        reading: str = Field(description="Grade for Reading & thinking")
        health: str = Field(description="Grade for Health & admin")
        next_steps: str = Field(description="Grade for Deciding what's next")
        verdict: str = Field(description="One sentence, 35 words maximum")
        bullets: list[str] = Field(
            description="Exactly three bullets, 30-50 words each. "
                        "Wrap the opening claim of each in <strong></strong>."
        )

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=RUBRIC,
        messages=[{"role": "user", "content": build_prompt(entries)}],
        output_format=Report,
    )

    # a policy decline arrives as HTTP 200 with stop_reason "refusal" — the
    # content is then unusable, so bail loudly rather than patch the page
    if getattr(response, "stop_reason", None) == "refusal":
        detail = getattr(response, "stop_details", None)
        raise SystemExit(f"model declined the request ({detail}); page left untouched")

    report = response.parsed_output
    if len(report.bullets) != 3:
        raise SystemExit(f"expected 3 bullets, got {len(report.bullets)}; page left untouched")
    usage = response.usage
    cost = (usage.input_tokens * 5 + usage.output_tokens * 25) / 1_000_000
    print(f"  {usage.input_tokens:,} in / {usage.output_tokens:,} out  ~${cost:.3f}")
    return report


# --------------------------------------------------------------------------
# 3. patch the page
# --------------------------------------------------------------------------

def sub_once(pattern: str, repl, html: str, what: str, flags=0) -> str:
    new, n = re.subn(pattern, repl, html, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"could not find {what} in {PAGE.name}; page left untouched")
    return new


def fill(text: str, indent: str, width: int = 78) -> str:
    body = textwrap.fill(" ".join(text.split()), width=width,
                         initial_indent="", subsequent_indent=indent)
    return body


def patch(html: str, r, today: dt.date, entries: list[Entry]) -> str:
    # -- the grade strip: current standing, so it is overwritten each run
    html = sub_once(
        r'(<div class="mark">)[^<]*(</div>)',
        lambda m: m.group(1) + r.overall + m.group(2),
        html, "the overall grade",
    )
    html = sub_once(
        r'(<p class="verdict">).*?(</p>)',
        lambda m: m.group(1) + fill(r.verdict, " " * 12) + m.group(2),
        html, "the verdict", flags=re.S,
    )
    for field, label in CARDS:
        html = sub_once(
            r'(<span class="g">)[^<]*(</span><span class="l">%s</span>)' % re.escape(label),
            lambda m, v=getattr(r, field): m.group(1) + v + m.group(2),
            html, f"the {label!r} card",
        )

    # -- a new report entry, inserted above the existing ones
    span = f"{entries[0].date:%b %-d} – {entries[-1].date:%b %-d %Y}"
    bullets = "\n".join(
        "            <li>" + fill(b, " " * 14) + "</li>" for b in r.bullets
    )
    entry = f"""
      <div class="entry ai-entry" data-hm="report">
        <div class="when">{today:%b %-d %Y}</div>
        <div>
          <p class="desc ai-head">{month_span(entries)} — summary by Claude</p>
          <ul>
{bullets}
          </ul>
          <p class="ai-note">Written by Claude from every entry below · {span}</p>
        </div>
      </div>
"""
    return html.replace(INSERT_MARKER, INSERT_MARKER + entry, 1)


def month_span(entries: list[Entry]) -> str:
    months = (entries[-1].date.year - entries[0].date.year) * 12 \
             + entries[-1].date.month - entries[0].date.month
    if months >= 12 and months % 12 == 0:
        n, unit = months // 12, "year"
    else:
        n, unit = max(months, 1), "month"
    return f"{n} {unit}{'s' if n != 1 else ''} in"


def check_balanced(html: str) -> None:
    """Cheap structural guard: the div count must still balance. A broken
    entry here is what jams the whole page layout."""
    stripped = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    depth = 0
    for m in re.finditer(r"<(/?)div\b", stripped, re.I):
        depth += -1 if m.group(1) else 1
    if depth != 0:
        raise SystemExit(f"patched HTML has unbalanced divs (depth {depth}); not written")


# --------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true",
                    help="print the new grades without touching the file")
    ap.add_argument("--commit", action="store_true",
                    help="git-commit the patched page (default: leave it for review)")
    ap.add_argument("--date", metavar="YYYY-MM-DD",
                    help="date to file the report under (default: today)")
    args = ap.parse_args()

    today = dt.date.fromisoformat(args.date) if args.date else dt.date.today()
    html = PAGE.read_text(encoding="utf-8")

    entries = read_entries(html)
    if not entries:
        raise SystemExit(f"no dated journal entries found in {PAGE.name}")
    print(f"read {len(entries)} entries, {entries[0].date} to {entries[-1].date}")

    if INSERT_MARKER not in html:
        raise SystemExit(f"{INSERT_MARKER} missing from {PAGE.name}; "
                         "add it where new reports should go")

    print(f"grading with {MODEL} ...")
    r = get_grades(entries)

    print(f"\n  overall              {r.overall}")
    for field, label in CARDS:
        print(f"  {label.replace('&amp;', '&'):20} {getattr(r, field)}")
    print(f"\n  {fill(r.verdict, '  ', 74)}\n")
    for b in r.bullets:
        print(f"  • {fill(re.sub(r'</?strong>', '', b), '    ', 74)}")
    print()

    if args.dry_run:
        print("--dry-run: nothing written")
        return 0

    new = patch(html, r, today, entries)
    check_balanced(new)

    backup = PAGE.with_suffix(".html.bak")
    shutil.copy2(PAGE, backup)
    PAGE.write_text(new, encoding="utf-8")
    print(f"patched {PAGE.name}  (previous version saved as {backup.name})")

    if args.commit:
        subprocess.run(["git", "-C", str(REPO), "add", PAGE.name], check=True)
        subprocess.run(["git", "-C", str(REPO), "commit", "-m",
                        f"regrade: {today:%b %-d %Y} report ({r.overall})"], check=True)
        print("committed")
    else:
        print("left uncommitted for review — `git diff garden-leave.html`")
    return 0


if __name__ == "__main__":
    sys.exit(main())
