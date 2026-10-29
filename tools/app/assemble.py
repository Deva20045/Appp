import sys, os, json, base64
HERE = os.path.dirname(os.path.abspath(__file__))
bank_path = os.environ.get('BANK', os.path.join(HERE,'..','bank.json'))
bank = open(bank_path, encoding='utf-8').read().replace('<', '\\u003c')
assert '</' not in bank and '<!--' not in bank
head = open(os.path.join(HERE,'head.html'), encoding='utf-8').read()
for marker, filename in [('__DM_SANS_BASE64__','dm-sans-latin.woff2'), ('__JAKARTA_BASE64__','plus-jakarta-latin.woff2')]:
    raw = open(os.path.join(HERE,'fonts',filename),'rb').read()
    assert raw.startswith(b'wOF2'), filename
    head = head.replace(marker, base64.b64encode(raw).decode('ascii'))
assert '__DM_SANS_BASE64__' not in head and '__JAKARTA_BASE64__' not in head
app  = open(os.path.join(HERE,'app.js'), encoding='utf-8').read()
html = (head + '\n<script id="bankData" type="application/json">' + bank + '</script>\n'
        + '<script>\n' + app + '\n</script>\n</body>\n</html>\n')
out = sys.argv[1] if len(sys.argv)>1 else 'pulse-mbbs.html'
open(out,'w',encoding='utf-8').write(html)
print(out, round(len(html.encode())/1048576,2), 'MB')
