#!/usr/bin/env python3
"""Repack + re-sign PULSE-MBBS-offline.apk without the Android SDK.

Why this exists
---------------
`build.sh` is the normal path: it uses aapt/d8/apksigner from Build-Tools 34 and
javac from a JDK. When none of those are available (no JDK on the box, and
dl.google.com unreachable so setup-sdk.py cannot fetch them) this script does the
one job that actually changes between releases: swap the embedded
`assets/index.html` and re-sign the APK with the *same* signing key, so Android
accepts it as an in-place update and keeps the learner's progress.

It deliberately does NOT recompile anything. AndroidManifest.xml, classes.dex,
resources.arsc and the icon are carried over byte-for-byte from the previous
signed APK, so the app binary is unchanged; only the web payload and signatures
differ. That is exactly what build.sh would produce for this release, because
the Java sources are untouched.

What it writes
--------------
* a ZIP with the same eight entries in the same order, STORED entries 4-byte
  aligned (zipalign rules) and everything else deflated
* v1 (JAR) signature: MANIFEST.MF, PULSEMBB.SF, PULSEMBB.RSA
* v2 and v3 signature blocks (RSA PKCS#1 v1.5 with SHA-256, chunked content
  digest), mirroring the scheme versions and attributes of the previous APK

Both writers are checked against the previous APK before anything is emitted:
the v1 writer must reproduce its existing META-INF bytes exactly, and the digest
routine must reproduce the digest recorded in its existing v2 block. If either
self-test fails the script refuses to sign.

Usage
-----
    python3 tools/apk/sign_apk.py \
        --apk PULSE-MBBS-offline.apk \
        --html index.html \
        --key /path/to/pulse-upload.p12 \
        --password-file /path/to/password.txt \
        --out PULSE-MBBS-offline.apk
"""
import argparse, base64, hashlib, io, os, struct, sys, zipfile, zlib

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from asn1crypto import cms, x509 as asn1x509

# ---- APK Signature Scheme constants (see AOSP apksig) ----
SIG_RSA_PKCS1_SHA256 = 0x0103          # signature algorithm ID
CHUNK_SIZE = 1024 * 1024
MAGIC = b'APK Sig Block 42'
ID_V2 = 0x7109871A
ID_V3 = 0xF05368C0
ID_PADDING = 0x42726577
V3_MIN_SDK = 24                        # v3 applies from Android 7.0
V3_MAX_SDK = 0x7FFFFFFF

WEB_ENTRY = 'assets/index.html'
META_PREFIX = 'META-INF/'
SF_NAME = 'META-INF/PULSEMBB.SF'
RSA_NAME = 'META-INF/PULSEMBB.RSA'
MF_NAME = 'META-INF/MANIFEST.MF'


def u32(v):
    return struct.pack('<I', v)


def u64(v):
    return struct.pack('<Q', v)


def lp(data):
    """AOSP length-prefixed field: u32 length + payload."""
    return u32(len(data)) + data


def cd_off_of(data):
    eocd = data.rfind(b'PK\x05\x06')
    return struct.unpack('<I', data[eocd + 16:eocd + 20])[0]


def read_lp(buf, off):
    n = struct.unpack('<I', buf[off:off + 4])[0]
    return buf[off + 4:off + 4 + n], off + 4 + n


# --------------------------------------------------------------------------
# ZIP reading
# --------------------------------------------------------------------------
def read_entries(path):
    """Return [(name, method, raw_bytes, crc, usize)] preserving file order."""
    out = []
    with open(path, 'rb') as fh:
        data = fh.read()
    zf = zipfile.ZipFile(io.BytesIO(data))
    for info in zf.infolist():
        raw = zf.open(info).read()          # decompressed payload
        out.append((info.filename, info.compress_type, raw, info.CRC, info.file_size))
    return out, data


def parse_signing_block(data):
    """Locate the APK Signing Block; return (block_start, {id: value})."""
    eocd = data.rfind(b'PK\x05\x06')
    cd_off = struct.unpack('<I', data[eocd + 16:eocd + 20])[0]
    if data[cd_off - 16:cd_off] != MAGIC:
        return None, {}
    size2 = struct.unpack('<Q', data[cd_off - 24:cd_off - 16])[0]
    start = cd_off - 8 - size2
    size1 = struct.unpack('<Q', data[start:start + 8])[0]
    assert size1 == size2, 'APK Signing Block size fields disagree'
    pairs = {}
    p = start + 8
    end = cd_off - 24          # block ends with: u64 size, then the 16-byte magic
    while p < end:
        ln = struct.unpack('<Q', data[p:p + 8])[0]
        pid = struct.unpack('<I', data[p + 8:p + 12])[0]
        pairs[pid] = data[p + 12:p + 8 + ln]
        p += 8 + ln
    assert p == end, 'APK Signing Block pairs overran'
    return start, pairs


def parse_v2_signers(value):
    """Pull (content_digest, cert_der, attrs_seq, min_sdk, max_sdk) out of a v2/v3 value."""
    seq, _ = read_lp(value, 0)
    signer, _ = read_lp(seq, 0)
    signed_data, off = read_lp(signer, 0)
    digests, o = read_lp(signed_data, 0)
    rec, _ = read_lp(digests, 0)
    alg = struct.unpack('<I', rec[0:4])[0]
    digest, _ = read_lp(rec, 4)
    certs, o = read_lp(signed_data, o)
    cert, _ = read_lp(certs, 0)
    attrs, _ = read_lp(signed_data, o)
    min_sdk = max_sdk = None
    # v3 stores min/max SDK directly after signed_data
    rest = signer[off:]
    if len(rest) >= 8:
        a, b = struct.unpack('<II', rest[0:8])
        if b >= a and b >= 24:          # plausible SDK range -> this is v3
            min_sdk, max_sdk = a, b
    return alg, digest, cert, attrs, min_sdk, max_sdk


# --------------------------------------------------------------------------
# Content digest (chunked, per section)
# --------------------------------------------------------------------------
def chunked_digest(sections):
    """AOSP chunked content digest: 0xa5-prefixed 1 MB chunks, 0x5a top hash."""
    chunk_digests = []
    for section in sections:
        for i in range(0, len(section), CHUNK_SIZE):
            chunk = section[i:i + CHUNK_SIZE]
            chunk_digests.append(hashlib.sha256(b'\xa5' + u32(len(chunk)) + chunk).digest())
    top = b'\x5a' + u32(len(chunk_digests)) + b''.join(chunk_digests)
    return hashlib.sha256(top).digest()


def content_digest(entry_region, central_dir, eocd_bytes):
    """Digest of the APK as if unsigned: EOCD points the CD straight after entries."""
    return chunked_digest([entry_region, central_dir, eocd_bytes])


# --------------------------------------------------------------------------
# ZIP writing
# --------------------------------------------------------------------------
DOS_TIME, DOS_DATE = 0, 0x0021          # 1980-01-01, deterministic output


def build_zip(entries):
    """entries: [(name, method, data)] -> (bytes, central_dir_bytes, eocd_template)."""
    out = bytearray()
    central = bytearray()
    for name, method, data in entries:
        name_b = name.encode('utf-8')
        crc = zlib.crc32(data) & 0xFFFFFFFF
        if method == zipfile.ZIP_DEFLATED:
            comp = zlib.compressobj(9, zlib.DEFLATED, -15)
            payload = comp.compress(data) + comp.flush()
        else:
            payload = data
        lho = len(out)
        # 4-byte alignment for STORED entries (resources.arsc must be mappable)
        extra = b''
        if method == zipfile.ZIP_STORED:
            base = lho + 30 + len(name_b)
            pad = (-(base + 6)) % 4
            extra = struct.pack('<HH', 0xD935, 2 + pad) + struct.pack('<H', 4) + b'\x00' * pad
        header = struct.pack('<4s5H3I2H', b'PK\x03\x04', 20, 0, method,
                             DOS_TIME, DOS_DATE, crc, len(payload), len(data),
                             len(name_b), len(extra))
        out += header + name_b + extra + payload
        central += struct.pack('<4s6H3I5H2I', b'PK\x01\x02', 20, 20, 0, method,
                               DOS_TIME, DOS_DATE, crc, len(payload), len(data),
                               len(name_b), len(extra), 0, 0, 0, 0, lho)
        central += name_b + extra
    return bytes(out), bytes(central), len(out)


def build_eocd(n_entries, cd_size, cd_off):
    return struct.pack('<4s4H2IH', b'PK\x05\x06', 0, 0, n_entries, n_entries,
                       cd_size, cd_off, 0)


# --------------------------------------------------------------------------
# v1 (JAR) signature
# --------------------------------------------------------------------------
def jar_section(name, digest_b64):
    return 'Name: %s\r\nSHA-256-Digest: %s\r\n\r\n' % (name, digest_b64)


def build_manifest(entries):
    """MANIFEST.MF over every entry except META-INF/*."""
    body = 'Manifest-Version: 1.0\r\n\r\n'
    for name, method, data in sorted(entries, key=lambda e: e[0]):
        if name.startswith(META_PREFIX):
            continue
        body += jar_section(name, base64.b64encode(hashlib.sha256(data).digest()).decode())
    return body.encode('utf-8')


def build_sf(manifest_bytes, entries, schemes='2, 3'):
    """PULSEMBB.SF: digest of the whole manifest plus of each manifest section."""
    head = ('Signature-Version: 1.0\r\n'
            'Created-By: 1.0 (Android)\r\n'
            'SHA-256-Digest-Manifest: %s\r\n'
            'X-Android-APK-Signed: %s\r\n\r\n'
            % (base64.b64encode(hashlib.sha256(manifest_bytes).digest()).decode(), schemes))
    body = head
    for name, method, data in sorted(entries, key=lambda e: e[0]):
        if name.startswith(META_PREFIX):
            continue
        # the digested unit is the manifest section including its blank line
        section = jar_section(name, base64.b64encode(hashlib.sha256(data).digest()).decode())
        body += jar_section(name, base64.b64encode(
            hashlib.sha256(section.encode('utf-8')).digest()).decode())
    return body.encode('utf-8')


def build_pkcs7(sf_bytes, key, cert):
    """Detached PKCS#7 / CMS SignedData over the .SF, RSA PKCS#1 v1.5 + SHA-256.

    Mirrors what apksigner emits: SignedData v1, detached content, one
    certificate, a single SignerInfo with no authenticated attributes, so the
    signature is taken over the .SF bytes themselves.
    """
    signer_cert = asn1x509.Certificate.load(cert.public_bytes(Encoding.DER))
    signature = key.sign(sf_bytes, padding.PKCS1v15(), hashes.SHA256())
    signed_data = {
        'version': 'v1',
        'digest_algorithms': [{'algorithm': 'sha256'}],
        'encap_content_info': {'content_type': 'data'},
        'certificates': [signer_cert],
        'signer_infos': [{
            'version': 'v1',
            'sid': cms.SignerIdentifier({
                'issuer_and_serial_number': {
                    'issuer': signer_cert.issuer,
                    'serial_number': signer_cert.serial_number,
                }
            }),
            'digest_algorithm': {'algorithm': 'sha256'},
            'signature_algorithm': {'algorithm': 'rsassa_pkcs1v15'},
            'signature': signature,
        }],
    }
    return cms.ContentInfo({
        'content_type': 'signed_data',
        'content': cms.SignedData(signed_data),
    }).dump()


def verify_pkcs7(sig_der, data, cert_der):
    """Raise unless sig_der is a detached PKCS#7 signature over data by cert_der."""
    sd = cms.ContentInfo.load(sig_der)['content']
    assert sd['encap_content_info']['content'].native is None, 'signature is not detached'
    signer = sd['signer_infos'][0]
    assert signer['signed_attrs'].native is None, 'unexpected authenticated attributes'
    cert = certify = signer_cert_from(sd, cert_der)
    certify.public_key().verify(signer['signature'].native, data,
                                padding.PKCS1v15(), hashes.SHA256())


def signer_cert_from(sd, cert_der):
    from cryptography import x509 as cx509
    for choice in sd['certificates']:
        der = choice.chosen.dump()
        if der == cert_der:
            return cx509.load_der_x509_certificate(der)
    raise AssertionError('signing certificate missing from PKCS#7')


# --------------------------------------------------------------------------
# v2 / v3 signature blocks
# --------------------------------------------------------------------------
def _axml_strings(data):
    """Return (string_pool_offset, strings_start, offsets, read_fn) for a UTF-16 AXML pool."""
    off = 8
    while off + 8 <= len(data):
        ctype = struct.unpack('<H', data[off:off + 2])[0]
        csize = struct.unpack('<I', data[off + 4:off + 8])[0]
        if ctype == 0x0001:
            count = struct.unpack('<I', data[off + 8:off + 12])[0]
            flags = struct.unpack('<I', data[off + 16:off + 20])[0]
            strings_start = struct.unpack('<I', data[off + 20:off + 24])[0]
            assert not (flags & 0x100), 'expected a UTF-16 string pool'
            offsets = [struct.unpack('<I', data[off + 28 + 4 * i:off + 32 + 4 * i])[0]
                       for i in range(count)]
            return off, strings_start, offsets
        if csize <= 0:
            break
        off += csize
    raise AssertionError('no string pool in AndroidManifest.xml')


def _axml_attr_offsets(data):
    """Map manifest attribute name -> byte offset of its typed value."""
    pool, strings_start, offsets = _axml_strings(data)

    def read(i):
        o = pool + strings_start + offsets[i]
        ln = struct.unpack('<H', data[o:o + 2])[0]
        o += 2
        if ln & 0x8000:
            ln = ((ln & 0x7FFF) << 16) | struct.unpack('<H', data[o:o + 2])[0]
            o += 2
        return data[o:o + 2 * ln].decode('utf-16-le', 'replace'), o, ln

    names = [read(i)[0] for i in range(len(offsets))]
    off = 8
    while off + 8 <= len(data):
        ctype = struct.unpack('<H', data[off:off + 2])[0]
        csize = struct.unpack('<I', data[off + 4:off + 8])[0]
        if ctype == 0x0102:                       # START_ELEMENT
            name_idx = struct.unpack('<I', data[off + 20:off + 24])[0]
            if names[name_idx] == 'manifest':
                base = off + 16 + struct.unpack('<H', data[off + 24:off + 26])[0]
                step = struct.unpack('<H', data[off + 26:off + 28])[0]
                count = struct.unpack('<H', data[off + 28:off + 30])[0]
                out = {}
                for k in range(count):
                    a = base + k * step
                    _ns, nm, raw, _sz, _r, dtype, val = struct.unpack('<IIIHBBI', data[a:a + 20])
                    out[names[nm]] = {'value_off': a + 16, 'type': dtype, 'data': val, 'raw': raw}
                return out, names, read, pool, strings_start, offsets
        if csize <= 0:
            break
        off += csize
    raise AssertionError('no <manifest> element in AndroidManifest.xml')


def bump_version(axml, new_name=None, new_code=None):
    """Set versionName / versionCode inside the binary AndroidManifest.xml.

    Both edits are length-preserving: versionCode is a 32-bit integer attribute
    and versionName is replaced only when the new value occupies exactly the same
    number of UTF-16 code units, so no chunk sizes or offsets move.
    """
    data = bytearray(axml)
    attrs, names, read, pool, strings_start, offsets = _axml_attr_offsets(axml)

    if new_code is not None:
        a = attrs['versionCode']
        assert a['type'] == 0x10, 'versionCode is not an integer attribute'
        struct.pack_into('<I', data, a['value_off'], int(new_code))
        # the attribute's raw string, when present, must agree with the integer
        if a['raw'] not in (0xFFFFFFFF, None) and a['raw'] < len(names):
            old_raw = names[a['raw']]
            if old_raw.isdigit():
                assert len(old_raw) == len(str(new_code)), 'versionCode raw string length differs'
                o = pool + strings_start + offsets[a['raw']]
                ln = struct.unpack('<H', data[o:o + 2])[0]
                o += 2
                if ln & 0x8000:
                    o += 2
                data[o:o + 2 * len(old_raw)] = str(new_code).encode('utf-16-le')

    if new_name is not None:
        a = attrs['versionName']
        assert a['type'] == 0x03, 'versionName is not a string attribute'
        idx = a['data']
        old, soff, chars = read(idx)
        assert len(new_name) == chars, (
            'versionName must keep its length (%d UTF-16 units) so the manifest '
            'layout does not move; %r is %d' % (chars, new_name, len(new_name)))
        assert all(ord(c) < 0x10000 for c in new_name), 'versionName must be BMP characters'
        data[soff:soff + 2 * chars] = new_name.encode('utf-16-le')

    # read it back before handing it over
    check, names2, read2, *_ = _axml_attr_offsets(bytes(data))
    if new_code is not None:
        got = struct.unpack('<I', bytes(data)[check['versionCode']['value_off']:
                                            check['versionCode']['value_off'] + 4])[0]
        assert got == int(new_code), 'versionCode did not stick'
    if new_name is not None:
        got = read2(check['versionName']['data'])[0]
        assert got == new_name, 'versionName did not stick'
    return bytes(data)


def locate_block_fields(value):
    """Return absolute byte offsets of the content digest and signature in a v2/v3 value.

    Walking the same nesting apksigner wrote lets us patch a known-good signing
    block in place rather than re-deriving the container format. Both fields keep
    their length (32-byte digest, 384-byte RSA signature), so every length prefix
    in the block stays valid.

    value = u32(len(seq)) + seq
    seq   = u32(len(signer)) + signer
    signer= u32(len(sd)) + sd + [u32 minSdk, u32 maxSdk] + u32(len(sigs)) + sigs + u32(len(pk)) + pk
    sd    = u32(len(digests)) + u32(len(item)) + u32(alg) + u32(len(digest)) + digest + ...
    sigs  = u32(len(item)) + u32(alg) + u32(len(sig)) + sig
    """
    seq, _ = read_lp(value, 0)
    signer, _ = read_lp(seq, 0)
    sd, sd_end = read_lp(signer, 0)              # sd_end: offset within signer
    digests, digests_off = read_lp(sd, 0)
    item, _ = read_lp(digests, 0)
    alg = struct.unpack('<I', item[0:4])[0]
    digest, _ = read_lp(item, 4)

    SIGNER_OFF = 8                               # 4 (value seq len) + 4 (seq signer len)
    SD_START = SIGNER_OFF + 4                    # past signer's own signed_data length
    # digest: sd start + 4 (digests len) + 4 (item len) + 4 (alg) + 4 (digest len)
    digest_off = SD_START + 4 + 4 + 4 + 4

    rest = sd_end                                # offset within signer, after signed_data
    if len(signer) - rest >= 8:                  # v3 stores minSdk/maxSdk in the signer
        lo, hi = struct.unpack('<II', signer[rest:rest + 8])
        if lo >= 24 and hi >= lo:
            rest += 8
    sigs, _ = read_lp(signer, rest)
    sig_item, _ = read_lp(sigs, 0)
    sig_len = struct.unpack('<I', sig_item[4:8])[0]
    # signer offset + 4 (sigs len) + 4 (item len) + 4 (alg) + 4 (sig len)
    sig_off = SIGNER_OFF + rest + 4 + 4 + 4 + 4

    assert value[digest_off:digest_off + len(digest)] == digest, 'digest offset wrong'
    return {
        'alg': alg,
        'digest': digest,
        'digest_off': digest_off,
        'sd_start': SD_START,
        'sd_len': len(sd),
        'sig_off': sig_off,
        'sig_len': sig_len,
    }


def resign_pair(value, info, new_digest, key):
    """Patch the content digest, recompute the signature, return the new value."""
    out = bytearray(value)
    assert len(new_digest) == len(info['digest']), 'content digest length changed'
    out[info['digest_off']:info['digest_off'] + len(new_digest)] = new_digest
    signed_data = bytes(out[info['sd_start']:info['sd_start'] + info['sd_len']])
    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    assert len(signature) == info['sig_len'], 'signature length changed'
    out[info['sig_off']:info['sig_off'] + info['sig_len']] = signature
    return bytes(out)


def build_signing_block(pairs, pad_to=None):
    """pairs: {id: value}. Layout: u64 size, pairs, u64 size, magic."""
    body = b''.join(u64(4 + len(v)) + u32(pid) + v for pid, v in pairs.items())
    if pad_to is not None:
        extra = pad_to - (len(body) + 32)      # 8 leading size + 8 trailing + 16 magic
        pad_len = extra - 8
        if pad_len >= 4:
            body += u64(pad_len) + u32(ID_PADDING) + b'\x00' * (pad_len - 4)
    size = len(body) + 24
    return u64(size) + body + u64(size) + MAGIC


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apk', required=True, help='previous signed APK to update in place')
    ap.add_argument('--html', required=True, help='new index.html to embed')
    ap.add_argument('--key', required=True, help='PKCS#12 keystore')
    ap.add_argument('--password-file', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--version-name', help='new versionName (must keep its length, e.g. 1.3 -> 1.4)')
    ap.add_argument('--version-code', type=int, help='new integer versionCode')
    ap.add_argument('--alias-note', default='', help='unused, documents the key alias')
    args = ap.parse_args()

    entries, old_bytes = read_entries(args.apk)
    block_start, pairs = parse_signing_block(old_bytes)
    assert block_start is not None, 'previous APK has no v2/v3 signing block'
    assert ID_V2 in pairs, 'previous APK is not v2 signed'
    assert ID_V3 in pairs, 'previous APK is not v3 signed'

    v2_alg, v2_digest, v2_cert, v2_attrs, _, _ = parse_v2_signers(pairs[ID_V2])
    v3_alg, v3_digest, v3_cert, v3_attrs, v3_min, v3_max = parse_v2_signers(pairs[ID_V3])
    old_triples = [(n, m, d) for n, m, d, c, u in entries]
    print('previous APK: %d entries, signing block %d bytes, v2/v3 digest %s'
          % (len(entries), struct.unpack('<Q', old_bytes[cd_off_of(old_bytes) - 24:
                                                      cd_off_of(old_bytes) - 16])[0] + 8,
             v2_digest.hex()[:16] + '...'))

    # ---- self-test 1: our digest routine reproduces the old block's digest ----
    eocd_old = old_bytes.rfind(b'PK\x05\x06')
    cd_off_old = struct.unpack('<I', old_bytes[eocd_old + 16:eocd_old + 20])[0]
    cd_size_old = struct.unpack('<I', old_bytes[eocd_old + 12:eocd_old + 16])[0]
    n_old = struct.unpack('<H', old_bytes[eocd_old + 10:eocd_old + 12])[0]
    eocd_as_unsigned = build_eocd(n_old, cd_size_old, block_start)
    got = content_digest(old_bytes[:block_start],
                         old_bytes[cd_off_old:cd_off_old + cd_size_old],
                         eocd_as_unsigned)
    assert got == v2_digest, ('content-digest self-test failed: %s vs %s'
                              % (got.hex(), v2_digest.hex()))
    print('self-test 1: content digest algorithm reproduces the previous APK  OK')

    # ---- self-test 2: our v1 writer reproduces the old MANIFEST.MF / .SF ----
    old_mf = dict(((n, d) for n, m, d, c, u in entries))
    manifest = build_manifest(old_triples)
    sf = build_sf(manifest, old_triples)
    assert manifest == old_mf[MF_NAME], 'v1 MANIFEST.MF self-test failed'
    assert sf == old_mf[SF_NAME], 'v1 .SF self-test failed'
    print('self-test 2: v1 MANIFEST.MF and .SF reproduce the previous APK  OK')
    verify_pkcs7(old_mf[RSA_NAME], old_mf[SF_NAME], v2_cert)
    print('self-test 3: previous PKCS#7 .RSA verifies over its .SF  OK')

    # ---- key --------------------------------------------------------------
    pw = open(args.password_file, 'rb').read().strip()
    key, cert, _ = pkcs12.load_key_and_certificates(open(args.key, 'rb').read(), pw)
    assert key is not None and cert is not None, 'keystore missing key or certificate'
    cert_der = cert.public_bytes(Encoding.DER)
    assert cert_der == v2_cert == v3_cert, (
        'this key is NOT the one that signed the previous APK '
        '(%s vs %s) - in-place updates would be rejected'
        % (hashlib.sha256(cert_der).hexdigest()[:16], hashlib.sha256(v2_cert).hexdigest()[:16]))
    pubkey_der = key.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    print('key: cert sha256 %s (matches the previous APK)  OK'
          % hashlib.sha256(cert_der).hexdigest())
    print('key: %d-bit RSA, public key %d bytes' % (key.key_size, len(pubkey_der)))

    # ---- new entries ------------------------------------------------------
    new_html = open(args.html, 'rb').read()
    bump = None
    if args.version_name or args.version_code is not None:
        bump = bump_version(dict(((n, d) for n, m, d, c, u in entries))['AndroidManifest.xml'],
                            args.version_name, args.version_code)
        old_attrs, _, read, *_ = _axml_attr_offsets(bump)
        print('manifest version -> %s / code %d (%d -> %d bytes)'
              % (read(old_attrs['versionName']['data'])[0],
                 struct.unpack('<I', bump[old_attrs['versionCode']['value_off']:
                                         old_attrs['versionCode']['value_off'] + 4])[0],
                 len(dict(((n, d) for n, m, d, c, u in entries))['AndroidManifest.xml']),
                 len(bump)))
    kept, replaced = [], False
    for name, method, data, crc, usize in entries:
        if name.startswith(META_PREFIX):
            continue                       # regenerated below
        if name == WEB_ENTRY:
            kept.append((name, method, new_html))
            replaced = True
        elif name == 'AndroidManifest.xml' and bump is not None:
            kept.append((name, method, bump))
        else:
            kept.append((name, method, data))
    assert replaced, 'previous APK has no %s entry' % WEB_ENTRY
    old_html_len = dict(((n, u) for n, m, d, c, u in entries))[WEB_ENTRY]
    print('embedded page: %d -> %d bytes' % (old_html_len, len(new_html)))

    manifest = build_manifest(kept)
    sf = build_sf(manifest, kept)
    rsa = build_pkcs7(sf, key, cert)
    final_entries = kept + [
        (SF_NAME, zipfile.ZIP_DEFLATED, sf),
        (RSA_NAME, zipfile.ZIP_DEFLATED, rsa),
        (MF_NAME, zipfile.ZIP_DEFLATED, manifest),
    ]

    # ---- unsigned layout: entries, then the central directory right after ----
    region, central, entries_end = build_zip(final_entries)
    eocd_unsigned = build_eocd(len(final_entries), len(central), entries_end)
    digest = content_digest(region, central, eocd_unsigned)
    print('new content digest: %s' % digest.hex())

    # ---- re-sign the previous block in place --------------------------------
    # Reusing the known-good apksigner block means the container layout cannot
    # drift: only the 32-byte content digest and the 384-byte signature change,
    # so every length prefix stays valid and the padding pair is kept verbatim.
    info2 = locate_block_fields(pairs[ID_V2])
    info3 = locate_block_fields(pairs[ID_V3])
    assert info2['digest'] == v2_digest and info3['digest'] == v3_digest
    assert info2['sd_len'] > 0 and info3['sd_len'] > 0

    # self-test 4: re-signing with the OLD digest must reproduce the OLD block
    assert resign_pair(pairs[ID_V2], info2, v2_digest, key) == pairs[ID_V2], \
        're-sign self-test failed for v2'
    assert resign_pair(pairs[ID_V3], info3, v3_digest, key) == pairs[ID_V3], \
        're-sign self-test failed for v3'
    print('self-test 4: re-signing with the previous digest reproduces the previous '
          'v2/v3 blocks byte-for-byte  OK')

    old_block_len = cd_off_old - block_start
    new_pairs = {}
    for pid, value in pairs.items():
        if pid == ID_V2:
            new_pairs[pid] = resign_pair(value, info2, digest, key)
        elif pid == ID_V3:
            new_pairs[pid] = resign_pair(value, info3, digest, key)
        else:
            new_pairs[pid] = value           # padding, byte for byte
    block = build_signing_block(new_pairs)
    assert len(block) == old_block_len, (
        'signing block size changed: %d vs %d' % (len(block), old_block_len))
    verify_pkcs7(rsa, sf, cert_der)
    print('new v1 signature verified over the new .SF  OK')
    cd_off = entries_end + len(block)
    eocd = build_eocd(len(final_entries), len(central), cd_off)

    out = region + block + central + eocd
    tmp = args.out + '.tmp'
    with open(tmp, 'wb') as fh:
        fh.write(out)
    os.replace(tmp, args.out)
    print('wrote %s: %d bytes (%.2f MB), signing block %d bytes'
          % (args.out, len(out), len(out) / 1048576, len(block)))
    print('v2/v3 min-max sdk mirror: v3 %s-%s' % (v3_min, v3_max))


if __name__ == '__main__':
    main()
