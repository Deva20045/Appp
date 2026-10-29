package com.deva20045.pulsembbs;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Local-only WebView: HTML, fonts, scripts and all 40,117 questions are bundled inside the APK. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String HOME = ORIGIN + "/assets/index.html";
    private static final int OPEN_BACKUP = 41;
    private static final int SAVE_BACKUP = 42;
    private static final int MAX_BACKUP_BYTES = 32 * 1024 * 1024;
    private WebView web;
    private volatile String pendingImportedJson;
    private String pendingExportJson;

    private WebResourceResponse error(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason,
            Collections.<String,String>emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(250,249,247));
        getWindow().setNavigationBarColor(Color.rgb(250,249,247));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(250,249,247));
        setContentView(web);
        WebSettings cfg = web.getSettings();
        cfg.setJavaScriptEnabled(true);
        cfg.setDomStorageEnabled(true); // App-private progress persists across launches.
        cfg.setAllowFileAccess(false);
        cfg.setAllowContentAccess(false);
        cfg.setAllowFileAccessFromFileURLs(false);
        cfg.setAllowUniversalAccessFromFileURLs(false);
        cfg.setJavaScriptCanOpenWindowsAutomatically(false);
        cfg.setSupportMultipleWindows(false);
        cfg.setDefaultTextEncodingName("UTF-8");
        cfg.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ORIGIN.equals(uri.getScheme() + "://" + uri.getAuthority())
                    && "/assets/index.html".equals(uri.getPath())) {
                    try {
                        return new WebResourceResponse("text/html", "UTF-8", getAssets().open("index.html"));
                    } catch (Exception e) {
                        return error(404, "Asset missing");
                    }
                }
                // Never fall through to the network, even if HTML contains an external URL.
                return error(403, "Offline only");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOME.equals(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !HOME.equals(url);
            }
        });
        web.setWebChromeClient(new WebChromeClient()); // JS confirm/reset dialogs
        web.addJavascriptInterface(new AndroidBridge(), "PulseAndroid");
        web.loadUrl(HOME);
    }

    public final class AndroidBridge {
        @JavascriptInterface public void pickProgressFile() {
            runOnUiThread(() -> {
                try {
                    Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    pick.setType("*/*"); // Some file providers mislabel JSON as text/plain.
                    startActivityForResult(pick, OPEN_BACKUP);
                } catch (Exception e) {
                    message("Could not open file picker");
                }
            });
        }

        @JavascriptInterface public void exportProgress(String json, String filename) {
            runOnUiThread(() -> {
                pendingExportJson = json;
                try {
                    Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    create.addCategory(Intent.CATEGORY_OPENABLE);
                    create.setType("application/json");
                    create.putExtra(Intent.EXTRA_TITLE, filename);
                    startActivityForResult(create, SAVE_BACKUP);
                } catch (Exception e) {
                    pendingExportJson = null;
                    message("Could not open save dialog");
                }
            });
        }

        @JavascriptInterface public String takeImportedJson() {
            String text = pendingImportedJson;
            pendingImportedJson = null;
            return text;
        }

        @JavascriptInterface public void setTheme(String theme) {
            runOnUiThread(() -> {
                boolean dark = "dark".equals(theme);
                int bg = dark ? Color.rgb(20,17,15) : Color.rgb(250,249,247);
                getWindow().setStatusBarColor(bg);
                getWindow().setNavigationBarColor(bg);
                if (Build.VERSION.SDK_INT >= 23) {
                    int flags = dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    if (!dark && Build.VERSION.SDK_INT >= 26)
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    getWindow().getDecorView().setSystemUiVisibility(flags);
                }
                web.setBackgroundColor(bg);
            });
        }

        @JavascriptInterface public void vibrate() {
            runOnUiThread(() -> {
                try {
                    Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                    if (v != null && v.hasVibrator()) v.vibrate(15);
                } catch (Exception ignored) { }
            });
        }
    }

    private void message(String text) {
        runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_SHORT).show());
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SAVE_BACKUP && (resultCode != RESULT_OK || data == null)) {
            pendingExportJson = null;
            return;
        }
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (requestCode == OPEN_BACKUP) {
            new Thread(() -> {
                try (InputStream in = getContentResolver().openInputStream(uri);
                     ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    if (in == null) throw new Exception("No file content");
                    byte[] buffer = new byte[16384];
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        if (output.size() + n > MAX_BACKUP_BYTES) throw new Exception("Backup is too large");
                        output.write(buffer, 0, n);
                    }
                    pendingImportedJson = new String(output.toByteArray(), StandardCharsets.UTF_8);
                    runOnUiThread(() -> web.evaluateJavascript(
                        "if(window.PulseNativeImport){window.PulseNativeImport(window.PulseAndroid.takeImportedJson())}", null));
                } catch (Exception e) {
                    message("Unable to open that backup file");
                }
            }, "pulse-import").start();
        } else if (requestCode == SAVE_BACKUP) {
            final String json = pendingExportJson;
            pendingExportJson = null;
            if (json == null) return;
            new Thread(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new Exception("No output stream");
                    out.write(json.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    message("Progress backup saved");
                } catch (Exception e) {
                    message("Could not save progress backup");
                }
            }, "pulse-export").start();
        }
    }

    @Override public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("window.PulseNativeBack ? window.PulseNativeBack() : false", response -> {
            if (!"true".equals(response)) MainActivity.super.onBackPressed();
        });
    }
    @Override protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
