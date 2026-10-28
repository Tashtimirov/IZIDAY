package ru.myday.app;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Calendar;

/** Все данные приложения — один файл data.json во внутренней памяти телефона. Пишет его страница (app.js), читают виджет и будильник. */
final class Store {
    private static final Object LOCK = new Object();

    private Store() {}

    static File file(Context c) { return new File(c.getFilesDir(), "data.json"); }

    static String read(Context c) {
        synchronized (LOCK) {
            File f = file(c);
            if (!f.exists()) return "";
            try {
                return readStream(new FileInputStream(f));
            } catch (Exception e) {
                return "";
            }
        }
    }

    static void write(Context c, String json) {
        synchronized (LOCK) {
            File f = file(c), tmp = new File(c.getFilesDir(), "data.json.tmp");
            try {
                FileOutputStream out = new FileOutputStream(tmp);
                out.write(json.getBytes("UTF-8"));
                out.getFD().sync();
                out.close();
                if (!tmp.renameTo(f)) throw new Exception("rename");
            } catch (Exception e) {
                tmp.delete();
            }
        }
    }

    static JSONObject data(Context c) {
        String s = read(c);
        try {
            return s.length() > 0 ? new JSONObject(s) : new JSONObject();
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static String readStream(InputStream in) throws Exception {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0) buf.write(b, 0, n);
        in.close();
        return buf.toString("UTF-8");
    }

    static String dayKey(Calendar d) {
        return String.format(java.util.Locale.US, "%04d-%02d-%02d", d.get(Calendar.YEAR), d.get(Calendar.MONTH) + 1, d.get(Calendar.DAY_OF_MONTH));
    }

    static JSONObject settings(JSONObject d) {
        JSONObject s = d.optJSONObject("settings");
        return s != null ? s : new JSONObject();
    }

    /** +1 стакан воды из виджета, не открывая приложение. Возвращает, сколько выпито за сегодня. */
    static int addWater(Context c) {
        synchronized (LOCK) {
            JSONObject d = data(c);
            try {
                int glass = settings(d).optInt("glass", 250);
                JSONObject w = d.optJSONObject("water");
                if (w == null) { w = new JSONObject(); d.put("water", w); }
                String k = dayKey(Calendar.getInstance());
                int v = w.optInt(k, 0) + glass;
                w.put(k, v);
                d.put("changed", System.currentTimeMillis());
                write(c, d.toString());
                return v;
            } catch (Exception e) {
                return -1;
            }
        }
    }

    /** Отметить напоминание выполненным (кнопка в уведомлении). Повторяющееся переносится на следующий раз. */
    static void completeReminder(Context c, String id) {
        synchronized (LOCK) {
            JSONObject d = data(c);
            JSONArray list = d.optJSONArray("reminders");
            if (list == null) return;
            try {
                long now = System.currentTimeMillis();
                for (int i = 0; i < list.length(); i++) {
                    JSONObject r = list.getJSONObject(i);
                    if (!id.equals(r.optString("id"))) continue;
                    JSONObject recur = r.optJSONObject("recur");
                    if (recur != null && r.has("due") && !r.isNull("due")) {
                        r.put("due", nextOccurrence(r.getLong("due"), recur));
                    } else {
                        r.put("done", true);
                        r.put("doneAt", now);
                    }
                    r.put("u", now);
                }
                d.put("changed", now);
                write(c, d.toString());
            } catch (Exception e) {
                // файл не трогаем
            }
        }
    }

    /** Та же логика, что nextDue() в app.js: каждый день или по дням недели (0 = вс). */
    static long nextOccurrence(long due, JSONObject recur) {
        Calendar d = Calendar.getInstance();
        d.setTimeInMillis(due);
        long now = System.currentTimeMillis();
        JSONArray days = recur.optJSONArray("days");
        for (int guard = 0; guard < 800; guard++) {
            d.add(Calendar.DAY_OF_MONTH, 1);
            boolean ok = true;
            if (days != null && days.length() > 0) {
                ok = false;
                int wd = d.get(Calendar.DAY_OF_WEEK) - 1;
                for (int j = 0; j < days.length(); j++) if (days.optInt(j) == wd) ok = true;
            }
            if (ok && d.getTimeInMillis() > now) return d.getTimeInMillis();
        }
        return d.getTimeInMillis();
    }
}
