/* Shared test environment helpers.
 *
 * PW_PATH  — path to the `playwright` module      (default: /tmp/node_modules/playwright)
 * PW_EXE   — path to a Chromium binary to drive   (default: Playwright's own download)
 * PULSE_HTML — the built single-file app to test  (default: file:///home/user/index.html)
 *
 * PW_EXE exists so the suites can run against a system/CI Chromium when Playwright's
 * own browser download is unavailable (no network, pin mismatch). With it unset the
 * behaviour is exactly what it always was.
 */
const path = require('path');

const PW_PATH = process.env.PW_PATH || '/tmp/node_modules/playwright';
const EXE = process.env.PW_EXE || '';

function launchOptions(extra) {
  const o = Object.assign({}, extra || {});
  if (EXE) {
    o.executablePath = EXE;
    o.args = (o.args || []).concat(['--no-sandbox', '--disable-dev-shm-usage']);
  }
  return o;
}

const HTML = process.env.PULSE_HTML
  ? (/^[a-z]+:\/\//i.test(process.env.PULSE_HTML) ? process.env.PULSE_HTML
     : 'file://' + path.resolve(process.env.PULSE_HTML))
  : 'file:///home/user/index.html';

module.exports = { PW_PATH, EXE, HTML, launchOptions };
