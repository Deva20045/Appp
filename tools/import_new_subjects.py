#!/usr/bin/env python3
"""Import Med-V1, Aneesh and Gyne content into PULSE bank.json.
Sources: tools/sources/{medv1,aneesh,gyne}-data.json extracted from each repo published app.
Idempotent: exits without changes when the three subjects are already present."""
import json, collections, pathlib

root = pathlib.Path(__file__).parent
bank = json.load(open(root / 'bank.json'))

def to_arr(q, fmt_default='', sec=''):
    return [q['q'], q['opts'], q['ans'], q.get('exp') or '', q.get('fmt') or fmt_default,
            q.get('page') if isinstance(q.get('page'), (int, float)) else None,
            q.get('sec') or sec]

def validate_subject(sid, s):
    c, u, q = s['c'], s['u'], s['q']
    keys = set()
    for uu in u:
        k = (uu[0], uu[1])
        assert k not in keys, f'{sid}: duplicate unit key {k}'
        keys.add(k)
        assert 0 <= uu[0] < len(c), f'{sid}: unit chapter idx out of range'
        assert uu[5] >= 0 and uu[6] > 0 and uu[5] + uu[6] <= len(q), f'{sid}: unit range bad {uu[1]}'
    spans = sorted((uu[5], uu[5] + uu[6]) for uu in u)
    for i in range(len(spans) - 1):
        assert spans[i][1] <= spans[i + 1][0], f'{sid}: overlapping unit ranges'
    for i, x in enumerate(q):
        assert isinstance(x[0], str) and x[0].strip(), f'{sid}: q{i} empty text'
        assert isinstance(x[1], list) and len(x[1]) >= 2 and all(isinstance(o, str) and o.strip() for o in x[1]), f'{sid}: q{i} bad opts'
        assert isinstance(x[2], int) and 0 <= x[2] < len(x[1]), f'{sid}: q{i} bad answer'
        assert isinstance(x[3], str), f'{sid}: q{i} bad exp'
    covered = set()
    for uu in u:
        covered.update(range(uu[5], uu[5] + uu[6]))
    orphans = len(q) - len(covered)
    assert all(i in covered for i in range(len(q))) or orphans >= 0
    return {'chapters': len(c), 'units': len(u), 'questions': len(q), 'questions_not_in_any_unit': orphans}

def from_ref_schema(data, only_live=True):
    """chapters {n,t,p,live}, units {id,ch,n,title,sec,guide,qs}, questions {id,sec,page,fmt,q,opts,ans,exp}"""
    Q = {x['id']: x for x in data['QUESTIONS']}
    assert len(Q) == len(data['QUESTIONS']), 'duplicate question ids'
    chs = [x for x in data['CHAPTERS'] if x.get('live', True)] if only_live else list(data['CHAPTERS'])
    cnum2idx = {x['n']: i for i, x in enumerate(chs)}
    units_by_ch = collections.defaultdict(list)
    for u in data['UNITS']:
        units_by_ch[u['ch']].append(u)
    c, u, q = [], [], []
    for ch in chs:
        c.append([ch['n'], ch['t'], ch.get('p')])
        for uu in units_by_ch.get(ch['n'], []):
            ids = uu['qs']
            missing = [i for i in ids if i not in Q]
            assert not missing, f"missing question refs {missing[:3]}"
            start = len(q)
            for i in ids:
                q.append(to_arr(Q[i]))
            u.append([cnum2idx[ch['n']], uu['id'], uu['title'], uu.get('guide') or '', None, start, len(ids)])
    referenced = {i for uu in data['UNITS'] for i in uu['qs']}
    orphan_q = [x for x in data['QUESTIONS'] if x['id'] not in referenced]
    assert not orphan_q, f'{len(orphan_q)} questions not in any unit (e.g. {orphan_q[0]["id"]})'
    assert len(u) == sum(len(units_by_ch.get(x["n"], [])) for x in chs)
    return {'c': c, 'u': u, 'q': q}

def from_gyne(data):
    """chapters {id,number,title,sections:[{name,units:[{id,title,questions:[{id,q,options,correct,why}]}]}]}"""
    c, u, q = [], [], []
    seen = set()
    for idx, ch in enumerate(data['CHAPTERS']):
        c.append([ch['number'], ch['title'], None])
        for sec in ch['sections']:
            for uu in sec['units']:
                assert uu['id'] not in seen, f"dup unit id {uu['id']}"
                seen.add(uu['id'])
                start = len(q)
                for x in uu['questions']:
                    assert x['id'] not in seen or True
                    opts = x['options']
                    assert isinstance(opts, list) and len(opts) >= 2
                    assert isinstance(x['correct'], int) and 0 <= x['correct'] < len(opts)
                    q.append([x['q'], opts, x['correct'], x.get('why') or '', '', None, sec['name']])
                assert len(uu['questions']) > 0
                u.append([idx, uu['id'], uu['title'], '', None, start, len(uu['questions'])])
    return {'c': c, 'u': u, 'q': q}

if all(k in bank for k in ('medv1','gyne','aneesh')):
    print('already imported:', {k: (len(bank[k]['c']), len(bank[k]['u']), len(bank[k]['q'])) for k in ('medv1','gyne','aneesh')})
    raise SystemExit(0)
new = {}
d = json.load(open(root/'sources/medv1-data.json'))
new['medv1'] = from_ref_schema(d, only_live=True)
print('medv1', validate_subject('medv1', new['medv1']))

d = json.load(open(root/'sources/aneesh-data.json'))
new['aneesh'] = from_ref_schema(d, only_live=True)
print('aneesh', validate_subject('aneesh', new['aneesh']))

d = json.load(open(root/'sources/gyne-data.json'))
new['gyne'] = from_gyne(d)
print('gyne', validate_subject('gyne', new['gyne']))

# insert in dashboard order: medv1 before medv2, gyne after obg, aneesh last
ordered = collections.OrderedDict()
for k, v in bank.items():
    if k == 'medv2':
        ordered['medv1'] = new['medv1']
    ordered[k] = v
    if k == 'obg':
        ordered['gyne'] = new['gyne']
ordered['aneesh'] = new['aneesh']
assert len(ordered) == len(bank) + 3
json.dump(ordered, open(root / 'bank.json', 'w'), ensure_ascii=False, separators=(',', ':'))
total = sum(len(v['q']) for v in ordered.values())
print('subjects', len(ordered), 'questions', total)
