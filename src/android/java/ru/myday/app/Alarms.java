package ru.myday.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * Уведомления о напоминаниях и обновление виджета в полночь.
 * Будильник всегда один: на ближайшее напоминание или на полночь. После срабатывания ставится следующий.
 */
public class Alarms extends BroadcastReceiver {
    static final String ACTION_ALARM = "ru.myday.app.ALARM";
    static final String ACTION_DONE = "ru.myday.app.DONE";
    static final String CHANNEL = "reminders";

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (ACTION_DONE.equals(a)) {
            String id = i.getStringExtra("id");
            if (id != null) Store.completeReminder(c, id);
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.cancel(i.getIntExtra("notif", 0));
        } else if (ACTION_ALARM.equals(a)) {
            notifyDue(c);
        } else {
            // загрузка телефона или обновление приложения: старые будильники стёрты
            prefs(c).edit().putLong("notifiedUpTo", System.currentTimeMillis()).apply();
        }
        WidgetProvider.updateAll(c);
        schedule(c);
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("alarms", Context.MODE_PRIVATE); }

    /** Напоминания со временем, которые ещё не выполнены. */
    private static JSONArray timed(Context c) {
        JSONArray out = new JSONArray();
        JSONArray list = Store.data(c).optJSONArray("reminders");
        if (list == null) return out;
        for (int i = 0; i < list.length(); i++) {
            JSONObject r = list.optJSONObject(i);
            if (r == null || r.optBoolean("done") || r.optBoolean("deleted") || !r.optBoolean("time") || r.isNull("due") || !r.has("due")) continue;
            out.put(r);
        }
        return out;
    }

    static void notifyDue(Context c) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        long upTo = p.getLong("notifiedUpTo", now - 60000);
        JSONArray list = timed(c);
        for (int i = 0; i < list.length(); i++) {
            JSONObject r = list.optJSONObject(i);
            long due = r.optLong("due");
            // пропущенные дольше 6 часов (телефон был выключен) не показываем пачкой
            if (due > upTo && due <= now + 30000 && due > now - 6 * 3600000L) show(c, r);
        }
        p.edit().putLong("notifiedUpTo", now + 30000).apply();
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            // NotificationChannel появился в Android 8 — через отражение, чтобы собирать под старый android.jar
            Class<?> ch = Class.forName("android.app.NotificationChannel");
            Object channel = ch.getConstructor(String.class, CharSequence.class, int.class)
                .newInstance(CHANNEL, "Напоминания", 4 /* IMPORTANCE_HIGH */);
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationManager.class.getMethod("createNotificationChannel", ch).invoke(nm, channel);
        } catch (Exception e) {
            // без канала уведомления на Android 8+ не показываются, но приложение работает
        }
    }

    static Notification.Builder builder(Context c) {
        ensureChannel(c);
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                return Notification.Builder.class.getConstructor(Context.class, String.class).newInstance(c, CHANNEL);
            } catch (Exception e) {
                // ниже — обычный конструктор
            }
        }
        return new Notification.Builder(c);
    }

    private static void show(Context c, JSONObject r) {
        String id = r.optString("id");
        int notif = id.hashCode();
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(c, notif, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent done = new Intent(c, Alarms.class).setAction(ACTION_DONE).putExtra("id", id).putExtra("notif", notif);
        PendingIntent donePi = PendingIntent.getBroadcast(c, notif, done, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = builder(c)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(r.optString("title", "Напоминание"))
            .setContentText("Мой день · напоминание")
            .setColor(0xFFD9952B)
            .setContentIntent(openPi)
            .setAutoCancel(true)
            .setPriority(Notification.PRIORITY_HIGH)
            .setDefaults(Notification.DEFAULT_ALL)
            .addAction(0, "✓ Готово", donePi)
            .build();
        try {
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(notif, n);
        } catch (Exception e) {
            // нет разрешения на уведомления
        }
    }

    /** Ставит один будильник: на ближайшее напоминание, но не позже полуночи. */
    static void schedule(Context c) {
        long now = System.currentTimeMillis();
        Calendar mid = Calendar.getInstance();
        mid.add(Calendar.DAY_OF_MONTH, 1);
        mid.set(Calendar.HOUR_OF_DAY, 0);
        mid.set(Calendar.MINUTE, 0);
        mid.set(Calendar.SECOND, 5);
        long next = mid.getTimeInMillis();
        JSONArray list = timed(c);
        for (int i = 0; i < list.length(); i++) {
            long due = list.optJSONObject(i).optLong("due");
            if (due > now && due < next) next = due;
        }
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, Alarms.class).setAction(ACTION_ALARM),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                exact = (Boolean) AlarmManager.class.getMethod("canScheduleExactAlarms").invoke(am);
            } catch (Exception e) {
                exact = false;
            }
        }
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        }
    }
}
