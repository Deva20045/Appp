#!/usr/bin/env python3
"""Append OPHTHAL chapters 31–50 without changing existing question indexes.

Source: Deva20045/OPHTHAL, main (chapter JSON artifacts). Run once against
an older bank; a populated chapter is skipped to keep existing progress stable.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BANK = ROOT / 'bank.json'
bank = json.loads(BANK.read_text(encoding='utf-8'))
oph = bank['oph']
added_units = added_questions = 0
for number in range(31, 51):
    chapter = json.loads((ROOT / 'sources' / 'ophthalmology' / f'ch{number:02}.json').read_text(encoding='utf-8'))
    ci = number - 1
    assert chapter['chapter'] == number and oph['c'][ci][0] == number
    assert chapter['title'] == oph['c'][ci][1]
    if any(u[0] == ci for u in oph['u']):
        continue
    questions = {q['id']: q for q in chapter['questions']}
    ids = [qid for u in chapter['units'] for qid in u['qs']]
    assert len(ids) == len(set(ids)) and set(ids) == set(questions)
    for unit in chapter['units']:
        start = len(oph['q'])
        for qid in unit['qs']:
            q = questions[qid]
            assert isinstance(q['ans'], int) and 0 <= q['ans'] < len(q['opts'])
            oph['q'].append([q['q'], q['opts'], q['ans'], q['exp'], q['fmt'], q['page'], q['sec']])
        oph['u'].append([ci, unit['id'], unit['title'], unit.get('guide', ''), None, start, len(unit['qs'])])
        added_units += 1
        added_questions += len(unit['qs'])
BANK.write_text(json.dumps(bank, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Added {added_units} units and {added_questions} questions')
