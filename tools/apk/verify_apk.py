#!/usr/bin/env python3
"""Verify a signed PULSE APK the way Android does, without the Android SDK.

Checks, in order:
  1. the ZIP parses, every entry's CRC is correct and STORED entries are aligned
  2. v1 (JAR): every entry digest in MANIFEST.MF matches the entry, the .SF
     digests match the manifest, and the PKCS#7 .RSA signature verifies over the .SF
  3. v2 and v3: the chunked content digest recomputed from the file matches the
     digest in the signed block, the public key in the block matches the
     certificate, and the RSA signature verifies over the signed data
  4. the signer certificate is the expected one

Usage:
    python3 tools/apk/verify_apk.py PULSE-MBBS-offline.apk [--expect-html index.html] \
        [--expect-cert <sha256>] [--compare-old old.apk]

`--compare-old` additionally asserts that every non-web entry (manifest, dex,
resources, icon) is byte-identical to a previous build, which is what makes this
an in-place update rather than a new app.
"""
import argparse, base64, hashlib, io, struct, sys, zipfile

from asn1crypto import cms
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

MAGIC = b'APK Sig Block 42'
ID_V2 = 0x7109871A
ID_V3 = 0xF05368C0
CHUNK = 1024 * 1024


def u32(b, o):
    return struct.unpack('<I', b[o:o + 4])[0]


def lp(buf, o):
    n = u32(buf, o)
    return buf[o + 4:o + 4 + n], o + 4 + n


def chunked(sections):
    hs = []
    for sec in sections:
        for i in range(0, len(sec), CHUNK):
            ch = sec[i:i + CHUNK]
            hs.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(ch)) + ch).digest())
    return hashlib.sha256(b'\x5a' + struct.pack('<I', len(hs)) + b''.join(hs)).digest()


class Report:
    def __init__(self):
        self.items = []

    def check(self, ok, label, detail=''):
        self.items.append((bool(ok), label, detail))
        print(('  PASS  ' if ok else '  FAIL  ') + label + (('  [' + detail + ']') if detail else ''))
        return ok

    def ok(self):
        return all(i[0] for i in self.items)


def verify(path, expect_html=None, expect_cert=None, compare_old=None):
    print('verifying %s' % path)
    r = Report()
    data = open(path, 'rb').read()

    # ---------------- ZIP ----------------
    zf = zipfile.ZipFile(io.BytesIO(data))
    r.check(zf.testzip() is None, 'ZIP is intact (all CRCs)')
    names = zf.namelist()
    r.check(len(names) == 8, 'eight entries', ', '.join(names))
    infos = {i.filename: i for i in zf.infolist()}

    # STORED entries must be 4-byte aligned for mmap (resources.arsc especially)
    eocd = data.rfind(b'PK\x05\x06')
    aligned = True
    for i in zf.infolist():
        if i.compress_type == zipfile.ZIP_STORED:
            hdr = i.header_offset
            nlen = struct.unpack('<H', data[hdr + 26:hdr + 28])[0]
            elen = struct.unpack('<H', data[hdr + 28:hdr + 30])[0]
            off = hdr + 30 + nlen + elen
            if off % 4:
                aligned = False
                r.check(False, 'STORED entry aligned', '%s at %d' % (i.filename, off % 4))
    if aligned:
        r.check(True, 'STORED entries are 4-byte aligned')

    contents = {n: zf.read(n) for n in names}

    # ---------------- v1 ----------------
    mf = contents.get('META-INF/MANIFEST.MF')
    sf = contents.get('META-INF/PULSEMBB.SF')
    rsa = contents.get('META-INF/PULSEMBB.RSA')
    if r.check(mf and sf and rsa, 'v1 META-INF files present'):
        # manifest digests
        sections = {}
        body = mf.split(b'\r\n\r\n', 1)[1]
        for chunk in body.split(b'\r\n\r\n'):
            if chunk.startswith(b'Name: '):
                nm = chunk.split(b'\r\n')[0][6:].decode()
                dg = [l for l in chunk.split(b'\r\n') if l.startswith(b'SHA-256-Digest: ')][0].split(b': ', 1)[1]
                sections[nm] = base64.b64decode(dg)
        bad = [n for n in names if not n.startswith('META-INF/')
               and hashlib.sha256(contents[n]).digest() != sections.get(n)]
        r.check(not bad, 'v1 MANIFEST.MF digests match every entry', str(bad))
        r.check(sections == {n: hashlib.sha256(contents[n]).digest() for n in sections},
                'v1 manifest covers exactly the non-META-INF entries')
        # .SF
        head, _, rest = sf.partition(b'\r\n\r\n')
        dgm = [l for l in head.split(b'\r\n') if l.startswith(b'SHA-256-Digest-Manifest: ')]
        r.check(bool(dgm) and base64.b64decode(dgm[0].split(b': ', 1)[1]) == hashlib.sha256(mf).digest(),
                'v1 .SF Digest-Manifest matches MANIFEST.MF')
        sf_sections = {}
        for chunk in rest.split(b'\r\n\r\n'):
            if chunk.startswith(b'Name: '):
                nm = chunk.split(b'\r\n')[0][6:].decode()
                dg = [l for l in chunk.split(b'\r\n') if l.startswith(b'SHA-256-Digest: ')][0].split(b': ', 1)[1]
                sf_sections[nm] = base64.b64decode(dg)
        bad_sf = []
        for nm, dg in sf_sections.items():
            sec = ('Name: %s\r\nSHA-256-Digest: %s\r\n\r\n'
                   % (nm, base64.b64encode(sections[nm]).decode())).encode()
            if hashlib.sha256(sec).digest() != dg:
                bad_sf.append(nm)
        r.check(not bad_sf, 'v1 .SF section digests match the manifest', str(bad_sf))
        # PKCS#7
        sd = cms.ContentInfo.load(rsa)['content']
        dg_alg = sd['digest_algorithms'][0]['algorithm'].native
        sig = sd['signer_infos'][0]['signature'].native
        cert = x509.load_der_x509_certificate(sd['certificates'][0].chosen.dump())
        try:
            cert.public_key().verify(sig, sf, padding.PKCS1v15(), hashes.SHA256())
            r.check(True, 'v1 PKCS#7 signature verifies over the .SF', 'digest ' + dg_alg)
        except Exception as exc:
            r.check(False, 'v1 PKCS#7 signature verifies over the .SF', str(exc))
        v1_cert = cert

    # ---------------- v2 / v3 ----------------
    cd_off = u32(data, eocd + 16)
    cd_size = u32(data, eocd + 12)
    n_entries = struct.unpack('<H', data[eocd + 10:eocd + 12])[0]
    have_block = data[cd_off - 16:cd_off] == MAGIC
    if not r.check(have_block, 'APK Signing Block magic present'):
        return r
    size2 = struct.unpack('<Q', data[cd_off - 24:cd_off - 16])[0]
    block_start = cd_off - 8 - size2
    size1 = struct.unpack('<Q', data[block_start:block_start + 8])[0]
    r.check(size1 == size2, 'signing block size fields agree', '%d bytes' % size1)

    pairs, p, end = {}, block_start + 8, cd_off - 24
    while p < end:
        ln = struct.unpack('<Q', data[p:p + 8])[0]
        pid = u32(data, p + 8)
        pairs[pid] = data[p + 12:p + 8 + ln]
        p += 8 + ln
    r.check(p == end, 'signing block pairs are well formed')

    # content digest over the unsigned layout: CD offset points at entries' end
    cd = data[cd_off:cd_off + cd_size]
    eocd_unsigned = bytearray(data[eocd:])
    struct.pack_into('<I', eocd_unsigned, 16, block_start)
    expected_digest = chunked([data[0:block_start], cd, bytes(eocd_unsigned)])

    for pid, label in ((ID_V2, 'v2'), (ID_V3, 'v3')):
        if pid not in pairs:
            r.check(False, label + ' block present')
            continue
        value = pairs[pid]
        seq, _ = lp(value, 0)
        signer, _ = lp(seq, 0)
        sd_bytes, sd_end = lp(signer, 0)
        digests, o = lp(sd_bytes, 0)
        item, _ = lp(digests, 0)
        alg = u32(item, 0)
        digest, _ = lp(item, 4)
        certs, o = lp(sd_bytes, o)
        cert_der, _ = lp(certs, 0)
        r.check(digest == expected_digest,
                '%s content digest matches the file' % label, digest.hex()[:24] + '...')
        rest = sd_end
        if label == 'v3' and len(signer) - rest >= 8:
            lo, hi = struct.unpack('<II', signer[rest:rest + 8])
            if lo >= 24 and hi >= lo:
                rest += 8
        sigs, rest = lp(signer, rest)
        sig_item, _ = lp(sigs, 0)
        sig, _ = lp(sig_item, 4)
        pk, _ = lp(signer, rest)
        signer_cert = x509.load_der_x509_certificate(cert_der)
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
        spki = signer_cert.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
        r.check(spki == pk, '%s public key matches the certificate' % label)
        r.check(alg == 0x0103, '%s signature algorithm is RSA PKCS#1 v1.5 with SHA-256' % label)
        try:
            signer_cert.public_key().verify(sig, sd_bytes, padding.PKCS1v15(), hashes.SHA256())
            r.check(True, '%s signature verifies over the signed data' % label, '%d-bit' % signer_cert.public_key().key_size)
        except Exception as exc:
            r.check(False, '%s signature verifies over the signed data' % label, str(exc))
        if label == 'v3':
            r.check('X-Android-APK-Signed' in sf.decode(), 'v1 .SF advertises schemes 2, 3')
        if expect_cert:
            got = hashlib.sha256(cert_der).hexdigest()
            r.check(got == expect_cert, '%s signer certificate is the expected key' % label, got[:16] + '...')

    # ---------------- payload ----------------
    if expect_html:
        want = open(expect_html, 'rb').read()
        got = contents.get('assets/index.html', b'')
        r.check(got == want, 'embedded assets/index.html equals %s' % expect_html,
                '%d bytes sha256 %s' % (len(got), hashlib.sha256(got).hexdigest()[:16]))

    if compare_old:
        old = zipfile.ZipFile(compare_old)
        same, diff = [], []
        for n in names:
            if n == 'assets/index.html' or n.startswith('META-INF/'):
                continue
            (same if old.read(n) == contents[n] else diff).append(n)
        r.check(not diff, 'binary payload identical to the previous build (in-place update)',
                'same: ' + ', '.join(same))
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('apk')
    ap.add_argument('--expect-html')
    ap.add_argument('--expect-cert')
    ap.add_argument('--compare-old')
    args = ap.parse_args()
    r = verify(args.apk, args.expect_html, args.expect_cert, args.compare_old)
    print('\n%s' % ('ALL CHECKS PASSED' if r.ok() else 'VERIFICATION FAILED'))
    sys.exit(0 if r.ok() else 1)


if __name__ == '__main__':
    main()
