package ru.myday.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.speech.RecognizerIntent;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.util.ArrayList;

/** Приложение — одна страница (assets/index.html) в WebView. Мост Android даёт ей файл данных, календарь, голос и файлы. */
public class MainActivity extends Activity {
    static final int REQ_SPEECH = 1, REQ_EXPORT = 2, REQ_IMPORT = 3, REQ_PERM = 4;
    WebView web;
    String pendingAction;
    String exportText;
    boolean pageReady;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#14263F"));
        w.setNavigationBarColor(Color.parseColor("#F8F7F3"));
        if (Build.VERSION.SDK_INT >= 26) w.getDecorView().setSystemUiVisibility(0x10 /* LIGHT_NAVIGATION_BAR */);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F8F7F3"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        pendingAction = actionOf(getIntent());
        web.loadUrl("file:///android_asset/index.html");
    }

    static String actionOf(Intent i) {
        return i != null ? i.getStringExtra("action") : null;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        String a = actionOf(i);
        if (a == null) return;
        if (pageReady) js("app.action(" + JSONObject.quote(a) + ")");
        else pendingAction = a;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pageReady) js("app.reload()");
    }

    void js(final String code) {
        runOnUiThread(new Runnable() {
            public void run() { web.evaluateJavascript(code, null); }
        });
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("app.back()", new ValueCallback<String>() {
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_SPEECH) {
            ArrayList<String> r = res == RESULT_OK && data != null ? data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) : null;
            js("app.onSpeech(" + (r != null && !r.isEmpty() ? JSONObject.quote(r.get(0)) : "null") + ")");
        } else if (req == REQ_EXPORT) {
            if (res != RESULT_OK || data == null || data.getData() == null) return;
            try {
                OutputStream out = getContentResolver().openOutputStream(data.getData());
                out.write(exportText.getBytes("UTF-8"));
                out.close();
                Toast.makeText(this, "Файл сохранён", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Не удалось сохранить файл", Toast.LENGTH_LONG).show();
            }
            exportText = null;
        } else if (req == REQ_IMPORT) {
            if (res != RESULT_OK || data == null || data.getData() == null) return;
            try {
                String text = Store.readStream(getContentResolver().openInputStream(data.getData()));
                js("app.onImport(" + JSONObject.quote(text) + ")");
            } catch (Exception e) {
                Toast.makeText(this, "Не удалось прочитать файл", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        js("app.onPermissions()");
        WidgetProvider.updateAll(this);
    }

    /** Методы, которые вызывает страница: window.Android.… */
    class Bridge {
        @JavascriptInterface public String load() { return Store.read(MainActivity.this); }

        @JavascriptInterface public void save(String json) {
            Store.write(MainActivity.this, json);
            WidgetProvider.updateAll(MainActivity.this);
            Alarms.schedule(MainActivity.this);
        }

        @JavascriptInterface public String takeAction() {
            pageReady = true;
            String a = pendingAction;
            pendingAction = null;
            return a;
        }

        @JavascriptInterface public String events(double from, double to) {
            JSONArray a = Cal.events(MainActivity.this, (long) from, (long) to);
            return a == null ? "null" : a.toString();
        }

        @JavascriptInterface public boolean hasCalendar() { return Cal.canRead(MainActivity.this) && Cal.canWrite(MainActivity.this); }

        @JavascriptInterface public String addEvent(String title, double start, double end, String rrule, String location, boolean allDay) {
            return Cal.addEvent(MainActivity.this, title, (long) start, (long) end, rrule, location, allDay);
        }

        @JavascriptInterface public String deleteEvent(double id) { return Cal.deleteEvent(MainActivity.this, (long) id); }

        @JavascriptInterface public String deleteOccurrence(double id, double begin) { return Cal.deleteOccurrence(MainActivity.this, (long) id, (long) begin); }

        @JavascriptInterface public String moveEvent(double id, double begin, double start, double end) {
            return Cal.moveEvent(MainActivity.this, (long) id, (long) begin, (long) start, (long) end);
        }

        /** Открыть событие в приложении календаря. */
        @JavascriptInterface public void openEvent(double id, double begin, double end) {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.withAppendedPath(CalendarContract.Events.CONTENT_URI, String.valueOf((long) id)))
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, (long) begin)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, (long) end);
            try { startActivity(i); } catch (ActivityNotFoundException e) { toast("Нет приложения календаря"); }
        }

        /** Создать событие через приложение календаря (если доступа к календарю нет). */
        @JavascriptInterface public void insertEventUi(String title, double start, double end, String rrule, String location) {
            Intent i = new Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, title)
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, (long) start)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, (long) end);
            if (rrule != null && rrule.length() > 0) i.putExtra(CalendarContract.Events.RRULE, rrule);
            if (location != null && location.length() > 0) i.putExtra(CalendarContract.Events.EVENT_LOCATION, location);
            try { startActivity(i); } catch (ActivityNotFoundException e) { toast("Нет приложения календаря"); }
        }

        @JavascriptInterface public void requestPermissions(String which) {
            final ArrayList<String> p = new ArrayList<String>();
            if (which.contains("calendar")) { p.add("android.permission.READ_CALENDAR"); p.add("android.permission.WRITE_CALENDAR"); }
            if (which.contains("notify") && Build.VERSION.SDK_INT >= 33) p.add("android.permission.POST_NOTIFICATIONS");
            if (which.contains("mic")) p.add("android.permission.RECORD_AUDIO");
            if (p.isEmpty()) { js("app.onPermissions()"); return; }
            runOnUiThread(new Runnable() {
                public void run() { MainActivity.this.requestPermissions(p.toArray(new String[0]), REQ_PERM); }
            });
        }

        @JavascriptInterface public boolean canNotify() {
            return Build.VERSION.SDK_INT < 33 || checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
        }

        /** Голосовой ввод системы (Google или распознавание производителя). Без сети работает, если скачан русский язык. */
        @JavascriptInterface public void listen() {
            runOnUiThread(new Runnable() {
                public void run() {
                    Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
                        .putExtra(RecognizerIntent.EXTRA_PROMPT, "Скажите команду")
                        .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                        .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                    try {
                        startActivityForResult(i, REQ_SPEECH);
                    } catch (ActivityNotFoundException e) {
                        js("app.onSpeech(null, 'nospeech')");
                    }
                }
            });
        }

        @JavascriptInterface public void exportFile(final String name, final String mime, String text) {
            exportText = text;
            runOnUiThread(new Runnable() {
                public void run() {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
                        .putExtra(Intent.EXTRA_TITLE, name);
                    try { startActivityForResult(i, REQ_EXPORT); } catch (ActivityNotFoundException e) { toast("Нет приложения для файлов"); }
                }
            });
        }

        @JavascriptInterface public void importFile() {
            runOnUiThread(new Runnable() {
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                    try { startActivityForResult(i, REQ_IMPORT); } catch (ActivityNotFoundException e) { toast("Нет приложения для файлов"); }
                }
            });
        }

        @JavascriptInterface public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(i, "Отправить"));
        }

        @JavascriptInterface public void toast(final String text) {
            runOnUiThread(new Runnable() {
                public void run() { Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show(); }
            });
        }

        /** После операции, начатой с виджета, — обратно на рабочий стол. */
        @JavascriptInterface public void home() {
            runOnUiThread(new Runnable() {
                public void run() { moveTaskToBack(true); }
            });
        }

        @JavascriptInterface public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }
    }
}
