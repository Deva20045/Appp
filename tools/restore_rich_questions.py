#!/usr/bin/env python3
"""Restore the free-text (fill) and matching (match) question payloads that the
flat 7-slot bank tuple cannot hold.

Background
----------
The Pharm source app stores three question kinds:

    mcq    { q, opts[], ans:int }
    fill   { q, blank, aliases[] }          <-- no options at all
    match  { q, left[], right[], ans[] }    <-- pairs, not options

`tools/import_new_subjects.py` maps every question onto
    [text, opts, ans, exp, fmt, page, sec]
so for the 464 fill and 90 match questions the useful payload was dropped:
opts became [] and ans became null / a list. In the app those questions
rendered a stem and *no answer controls*, so they could never be answered.

This script re-derives that payload from the published source page and stores it
in an optional 8th slot, leaving slots 0-6 untouched:

    q[7] = {"t":"fill",  "blank":"osteoblast", "aliases":[]}
    q[7] = {"t":"match", "left":[...], "right":[...], "key":[0,1,2,3]}

Idempotent: safe to re-run; it recomputes q[7] from the source every time.
"""
import json, pathlib, sys

root = pathlib.Path(__file__).parent
SRC = root / 'sources' / 'pharm-app.html'
SUBJECT = 'pharm'


def balanced(src, start):
    """Slice a balanced JSON array/object starting at `start`, string-aware."""
    op = src[start]
    cl = ']' if op == '[' else '}'
    depth = 0
    i = start
    instr = None
    esc = False
    while i < len(src):
        c = src[i]
        if instr:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == instr:
                instr = None
        elif c in '"\'':
            instr = c
        elif c == op:
            depth += 1
        elif c == cl:
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1
    raise ValueError('unbalanced literal starting at %d' % start)


def extract_questions(path):
    src = path.read_text(encoding='utf-8')
    marker = 'const QUESTIONS = ['
    at = src.find(marker)
    assert at >= 0, 'const QUESTIONS = [ not found in %s' % path
    return json.loads(balanced(src, src.index('[', at)))


def payload(q):
    """Return the optional q[7] extras for a source question, or None."""
    t = q.get('type')
    if t == 'fill':
        blank = q.get('blank')
        assert isinstance(blank, str) and blank.strip(), 'fill %s has no blank' % q.get('id')
        aliases = [a for a in (q.get('aliases') or []) if isinstance(a, str) and a.strip()]
        return {'t': 'fill', 'blank': blank, 'aliases': aliases}
    if t == 'match':
        left, right, ans = q.get('left'), q.get('right'), q.get('ans')
        assert isinstance(left, list) and isinstance(right, list), 'match %s missing pairs' % q.get('id')
        assert len(left) == len(right) >= 2, 'match %s pair length %d/%d' % (q.get('id'), len(left), len(right))
        assert isinstance(ans, list) and len(ans) == len(left), 'match %s bad key' % q.get('id')
        assert sorted(ans) == list(range(len(left))), 'match %s key is not a permutation' % q.get('id')
        return {'t': 'match', 'left': left, 'right': right, 'key': ans}
    return None


def main():
    bank_path = root / 'bank.json'
    bank = json.load(open(bank_path, encoding='utf-8'))
    if SUBJECT not in bank:
        sys.exit('no %r subject in bank' % SUBJECT)

    src_q = extract_questions(SRC)
    bq = bank[SUBJECT]['q']
    if len(src_q) != len(bq):
        sys.exit('count mismatch: source %d vs bank %d' % (len(src_q), len(bq)))

    added = cleared = 0
    kinds = {'fill': 0, 'match': 0}
    for i, (sq, row) in enumerate(zip(src_q, bq)):
        if sq['q'].strip() != str(row[0]).strip():
            sys.exit('order mismatch at %d: %r vs %r' % (i, sq['q'][:60], str(row[0])[:60]))
        extra = payload(sq)
        while len(row) < 7:
            row.append(None)
        if extra:
            if len(row) < 8:
                row.append(extra)
            else:
                row[7] = extra
            kinds[extra['t']] += 1
            added += 1
        elif len(row) >= 8:
            row[7] = None
            cleared += 1

    json.dump(bank, open(bank_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    total = sum(len(v['q']) for v in bank.values())
    print('restored %d rich questions into %r (fill=%d, match=%d, cleared=%d)'
          % (added, SUBJECT, kinds['fill'], kinds['match'], cleared))
    print('bank: %d subjects, %d questions' % (len(bank), total))


if __name__ == '__main__':
    main()
