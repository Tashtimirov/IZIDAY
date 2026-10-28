package ru.myday.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.TimeZone;

/** Календарь телефона (Google, Samsung, Outlook — всё, что синхронизировано в системный календарь). Работает и без сети. */
final class Cal {
    private Cal() {}

    static boolean canRead(Context c) {
        return c.checkSelfPermission("android.permission.READ_CALENDAR") == PackageManager.PERMISSION_GRANTED;
    }

    static boolean canWrite(Context c) {
        return c.checkSelfPermission("android.permission.WRITE_CALENDAR") == PackageManager.PERMISSION_GRANTED;
    }

    /** События (с развёрнутыми повторами) в промежутке [from, to). null — нет доступа. */
    static JSONArray events(Context c, long from, long to) {
        if (!canRead(c)) return null;
        JSONArray out = new JSONArray();
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, from);
        ContentUris.appendId(b, to);
        String[] cols = {
            CalendarContract.Instances.EVENT_ID, CalendarContract.Instances.BEGIN, CalendarContract.Instances.END,
            CalendarContract.Instances.TITLE, CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.EVENT_LOCATION,
            CalendarContract.Instances.RRULE, CalendarContract.Instances.CALENDAR_DISPLAY_NAME, CalendarContract.Instances.DISPLAY_COLOR,
            CalendarContract.Instances.VISIBLE,
        };
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(b.build(), cols, null, null, CalendarContract.Instances.BEGIN + " ASC");
            if (cur == null) return out;
            while (cur.moveToNext()) {
                if (cur.getInt(9) == 0) continue;
                long begin = cur.getLong(1), end = cur.getLong(2);
                boolean allDay = cur.getInt(4) == 1;
                if (allDay) {
                    // события «весь день» хранятся в UTC — переводим в местную полночь
                    begin = utcToLocal(begin);
                    end = utcToLocal(end);
                }
                JSONObject e = new JSONObject();
                e.put("id", cur.getLong(0));
                e.put("start", begin);
                e.put("end", end);
                e.put("title", cur.isNull(3) ? "" : cur.getString(3));
                e.put("allDay", allDay);
                e.put("location", cur.isNull(5) ? "" : cur.getString(5));
                e.put("recurring", !cur.isNull(6) && cur.getString(6).length() > 0);
                e.put("calendar", cur.isNull(7) ? "" : cur.getString(7));
                e.put("color", String.format("#%06X", 0xFFFFFF & cur.getInt(8)));
                out.put(e);
            }
        } catch (Exception ex) {
            return out;
        } finally {
            if (cur != null) cur.close();
        }
        return out;
    }

    private static long utcToLocal(long t) {
        return t - TimeZone.getDefault().getOffset(t);
    }

    /** Календарь для новых событий: основной из доступных для записи. -1 — нет ни одного. */
    static long targetCalendar(Context c) {
        String[] cols = { CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY, CalendarContract.Calendars.ACCOUNT_TYPE };
        Cursor cur = null;
        long best = -1;
        int bestScore = -1;
        try {
            cur = c.getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, cols,
                CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=" + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR
                    + " AND " + CalendarContract.Calendars.VISIBLE + "=1", null, null);
            if (cur == null) return -1;
            while (cur.moveToNext()) {
                int score = (!cur.isNull(1) && cur.getInt(1) == 1 ? 2 : 0) + ("com.google".equals(cur.getString(2)) ? 1 : 0);
                if (score > bestScore) { bestScore = score; best = cur.getLong(0); }
            }
        } catch (Exception e) {
            return -1;
        } finally {
            if (cur != null) cur.close();
        }
        return best;
    }

    /** "ok", "noperm" или "nocal". */
    static String addEvent(Context c, String title, long start, long end, String rrule, String location, boolean allDay) {
        if (!canWrite(c)) return "noperm";
        long cal = targetCalendar(c);
        if (cal < 0) return "nocal";
        ContentValues v = new ContentValues();
        v.put(CalendarContract.Events.CALENDAR_ID, cal);
        v.put(CalendarContract.Events.TITLE, title);
        if (location != null && location.length() > 0) v.put(CalendarContract.Events.EVENT_LOCATION, location);
        if (allDay) {
            v.put(CalendarContract.Events.ALL_DAY, 1);
            v.put(CalendarContract.Events.EVENT_TIMEZONE, "UTC");
            start = start + TimeZone.getDefault().getOffset(start);
            end = start + 86400000L;
        } else {
            v.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
        }
        v.put(CalendarContract.Events.DTSTART, start);
        if (rrule != null && rrule.length() > 0) {
            v.put(CalendarContract.Events.RRULE, rrule);
            v.put(CalendarContract.Events.DURATION, allDay ? "P1D" : "PT" + Math.max(1, (end - start) / 60000) + "M");
        } else {
            v.put(CalendarContract.Events.DTEND, end);
        }
        try {
            Uri u = c.getContentResolver().insert(CalendarContract.Events.CONTENT_URI, v);
            if (u == null) return "nocal";
            // напоминание за 15 минут, как в обычном календаре
            if (!allDay) {
                ContentValues r = new ContentValues();
                r.put(CalendarContract.Reminders.EVENT_ID, ContentUris.parseId(u));
                r.put(CalendarContract.Reminders.MINUTES, 15);
                r.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                c.getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI, r);
            }
            return "ok";
        } catch (Exception e) {
            return "error";
        }
    }

    static String deleteEvent(Context c, long id) {
        if (!canWrite(c)) return "noperm";
        try {
            int n = c.getContentResolver().delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id), null, null);
            return n > 0 ? "ok" : "notfound";
        } catch (Exception e) {
            return "error";
        }
    }

    /** Убирает одно повторение повторяющегося события (исключение на дату begin). */
    static String deleteOccurrence(Context c, long id, long begin) {
        if (!canWrite(c)) return "noperm";
        try {
            ContentValues v = new ContentValues();
            v.put(CalendarContract.Events.ORIGINAL_INSTANCE_TIME, begin);
            v.put(CalendarContract.Events.STATUS, CalendarContract.Events.STATUS_CANCELED);
            Uri u = c.getContentResolver().insert(
                Uri.withAppendedPath(CalendarContract.Events.CONTENT_EXCEPTION_URI, String.valueOf(id)), v);
            return u != null ? "ok" : "error";
        } catch (Exception e) {
            return "error";
        }
    }

    /** Переносит событие. У повторяющегося переносится одно повторение (begin — его текущее начало). */
    static String moveEvent(Context c, long id, long begin, long newStart, long newEnd) {
        if (!canWrite(c)) return "noperm";
        ContentResolver cr = c.getContentResolver();
        Cursor cur = null;
        String rrule = null;
        try {
            cur = cr.query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id),
                new String[] { CalendarContract.Events.RRULE }, null, null, null);
            if (cur != null && cur.moveToFirst() && !cur.isNull(0)) rrule = cur.getString(0);
        } catch (Exception e) {
            return "error";
        } finally {
            if (cur != null) cur.close();
        }
        try {
            ContentValues v = new ContentValues();
            v.put(CalendarContract.Events.DTSTART, newStart);
            v.put(CalendarContract.Events.DTEND, newEnd);
            if (rrule != null && rrule.length() > 0) {
                v.put(CalendarContract.Events.ORIGINAL_INSTANCE_TIME, begin);
                Uri u = cr.insert(Uri.withAppendedPath(CalendarContract.Events.CONTENT_EXCEPTION_URI, String.valueOf(id)), v);
                return u != null ? "ok" : "error";
            }
            int n = cr.update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id), v, null, null);
            return n > 0 ? "ok" : "notfound";
        } catch (Exception e) {
            return "error";
        }
    }
}
