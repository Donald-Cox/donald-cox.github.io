#!/usr/bin/env python3
"""Keep the shared style block byte-identical across every demo.

Source of truth is the block in 04-verification-kiosk.html between the
BEGIN and END marker comments, inclusive. Every other demo either already
carries that block, in which case it is replaced, or carries the single
placeholder line  /* @@SHARED@@ */  which is swapped for the real block.

Run from anywhere:
    python demos/sync-shared.py            report drift, change nothing
    python demos/sync-shared.py --write    make every demo match

Exit code 1 when any file is out of step, so it can gate a commit.
"""
import argparse
import io
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
SOURCE = HERE / "04-verification-kiosk.html"
BEGIN = "/* ==== NB SHARED TOKENS v1 ="
END = "/* ==== END NB SHARED TOKENS ="
PLACEHOLDER = "/* @@SHARED@@ */"


def read(path):
    """No newline translation, so a file's line endings survive a sync untouched."""
    with io.open(path, "r", encoding="utf-8", newline="") as fh:
        return fh.read()


def write(path, text):
    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def extract(text, path):
    start = text.find(BEGIN)
    if start == -1:
        sys.exit("no BEGIN marker in %s" % path)
    end = text.find(END, start)
    if end == -1:
        sys.exit("no END marker in %s" % path)
    line_end = text.find("\n", end)
    if line_end == -1:
        sys.exit("END marker is not on its own line in %s" % path)
    return text[start:line_end].rstrip(chr(13))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="rewrite files that drifted")
    args = ap.parse_args()

    if not SOURCE.exists():
        sys.exit("source of truth missing: %s" % SOURCE)
    block = extract(read(SOURCE), SOURCE.name)

    targets = sorted(p for p in HERE.glob("*.html") if p.name != SOURCE.name)
    if not targets:
        print("no other demos yet, nothing to sync")
        return 0

    drifted = []
    for path in targets:
        text = read(path)
        if PLACEHOLDER in text:
            new = text.replace(PLACEHOLDER, block, 1)
            state = "placeholder"
        elif BEGIN in text:
            current = extract(text, path.name)
            if current == block:
                print("  ok      %s" % path.name)
                continue
            new = text.replace(current, block, 1)
            state = "drifted"
        else:
            print("  SKIP    %s  (no shared block and no placeholder)" % path.name)
            continue

        drifted.append(path.name)
        if args.write:
            write(path, new)
            print("  written %s  (%s)" % (path.name, state))
        else:
            print("  DRIFT   %s  (%s)" % (path.name, state))

    if drifted and not args.write:
        print("\n%d file(s) out of step. Re-run with --write." % len(drifted))
        return 1
    print("\nall demos share one style block")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
