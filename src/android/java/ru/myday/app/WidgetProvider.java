package ru.myday.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Locale;

/** Виджет на рабочем столе: дата, события календаря, напоминания, вода, калории и расходы месяца. */
public class WidgetProvider extends AppWidgetProvider {
    static final String ACTION_WATER = "ru.myday.app.WATER";
    static final int GOLD = 0xFFD9952B, TEAL = 0xFF1E9E8F, RED = 0xFFC0502E, MUTED = 0xFF8A9AB0;
    static final String[] DAYS = { "Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота" };
    static final String[] MONTHS = { "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря" };
    static final String[] MONTHS_PREP = { "январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре" };

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c, m.getAppWidgetOptions(id)));
        Alarms.schedule(c);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle opts) {
        m.updateAppWidget(id, build(c, opts));
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (ACTION_WATER.equals(i.getAction())) {
            int ml = Store.addWater(c);
            if (ml >= 0) Toast.makeText(c, "💧 +1 стакан · сегодня " + liters(ml) + " л", Toast.LENGTH_SHORT).show();
            updateAll(c);
            return;
        }
        super.onReceive(c, i);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetProvider.class));
        for (int id : ids) m.updateAppWidget(id, build(c, m.getAppWidgetOptions(id)));
    }

    private static PendingIntent open(Context c, String action, int code) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (action != null) i.putExtra("action", action);
        i.setData(android.net.Uri.parse("myday://" + (action == null ? "open" : action)));
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static String liters(int ml) {
        return String.format(Locale.US, "%.2f", ml / 1000.0).replaceAll("0+$", "").replaceAll("\\.$", "").replace('.', ',');
    }

    static String money(double v) {
        String s = String.format(Locale.US, "%,d", Math.round(Math.abs(v)));
        return s.replace(',', ' ');
    }

    static String hm(long t) {
        Calendar d = Calendar.getInstance();
        d.setTimeInMillis(t);
        return String.format(Locale.US, "%02d:%02d", d.get(Calendar.HOUR_OF_DAY), d.get(Calendar.MINUTE));
    }

    private static void line(SpannableStringBuilder sb, String lead, int leadColor, String text, boolean dim) {
        if (sb.length() > 0) sb.append("\n");
        int a = sb.length();
        if (lead != null) {
            sb.append(lead).append("  ");
            sb.setSpan(new ForegroundColorSpan(leadColor), a, a + lead.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            sb.setSpan(new StyleSpan(Typeface.BOLD), a, a + lead.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        int b = sb.length();
        sb.append(text);
        if (dim) sb.setSpan(new ForegroundColorSpan(MUTED), b, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    }

    private static void header(SpannableStringBuilder sb, String text) {
        if (sb.length() > 0) sb.append("\n");
        int a = sb.length();
        sb.append(text.toUpperCase(new Locale("ru")));
        sb.setSpan(new ForegroundColorSpan(MUTED), a, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        sb.setSpan(new RelativeSizeSpan(0.78f), a, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        sb.setSpan(new StyleSpan(Typeface.BOLD), a, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    }

    static RemoteViews build(Context c, Bundle opts) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        JSONObject d = Store.data(c);
        JSONObject st = Store.settings(d);
        Calendar now = Calendar.getInstance();
        long nowMs = now.getTimeInMillis();

        v.setTextViewText(R.id.w_date, DAYS[now.get(Calendar.DAY_OF_WEEK) - 1] + ", " + now.get(Calendar.DAY_OF_MONTH) + " " + MONTHS[now.get(Calendar.MONTH)]);
        String cur = st.optString("currency", "₽");
        v.setTextViewText(R.id.w_money, cur);

        int h = opts != null ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
        if (h <= 0) h = 180;
        int maxLines = Math.max(2, (h - 78) / 18);

        Calendar sod = (Calendar) now.clone();
        sod.set(Calendar.HOUR_OF_DAY, 0);
        sod.set(Calendar.MINUTE, 0);
        sod.set(Calendar.SECOND, 0);
        sod.set(Calendar.MILLISECOND, 0);
        long today = sod.getTimeInMillis();
        sod.add(Calendar.DAY_OF_MONTH, 1);
        long tomorrow = sod.getTimeInMillis();
        sod.add(Calendar.DAY_OF_MONTH, 1);
        long after = sod.getTimeInMillis();

        ArrayList<Object[]> todayEv = new ArrayList<Object[]>(), tomorrowEv = new ArrayList<Object[]>();
        JSONArray evs = Cal.events(c, today, after);
        if (evs != null) {
            for (int i = 0; i < evs.length(); i++) {
                JSONObject e = evs.optJSONObject(i);
                long s = e.optLong("start"), en = e.optLong("end");
                boolean all = e.optBoolean("allDay");
                if (s < tomorrow && en > nowMs) todayEv.add(new Object[] { all ? "весь день" : (s < today ? "до " + hm(en) : hm(s)), e.optString("title") });
                else if (s >= tomorrow && s < after) tomorrowEv.add(new Object[] { all ? "весь день" : hm(s), e.optString("title") });
            }
        }

        // напоминания: просроченные и на сегодня, потом без даты
        ArrayList<Object[]> rems = new ArrayList<Object[]>();
        JSONArray rl = d.optJSONArray("reminders");
        if (rl != null) {
            ArrayList<JSONObject> dated = new ArrayList<JSONObject>(), undated = new ArrayList<JSONObject>();
            for (int i = 0; i < rl.length(); i++) {
                JSONObject r = rl.optJSONObject(i);
                if (r == null || r.optBoolean("done") || r.optBoolean("deleted")) continue;
                if (r.has("due") && !r.isNull("due")) { if (r.optLong("due") < tomorrow) dated.add(r); }
                else undated.add(r);
            }
            java.util.Collections.sort(dated, new java.util.Comparator<JSONObject>() {
                public int compare(JSONObject a, JSONObject b) { return Long.compare(a.optLong("due"), b.optLong("due")); }
            });
            for (JSONObject r : dated) {
                long due = r.optLong("due");
                boolean late = r.optBoolean("time") ? due < nowMs : due < today;
                String lead = r.optBoolean("time") ? hm(due) : (due < today ? "ранее" : "сегодня");
                rems.add(new Object[] { lead, r.optString("title"), late });
            }
            for (JSONObject r : undated) rems.add(new Object[] { "•", r.optString("title"), false });
        }

        SpannableStringBuilder sb = new SpannableStringBuilder();
        int used = 0;
        int evBudget = rems.isEmpty() ? maxLines : Math.max(1, Math.min(todayEv.size(), maxLines - Math.min(rems.size(), maxLines / 2) - 1));
        for (int i = 0; i < todayEv.size() && used < evBudget; i++, used++) line(sb, (String) todayEv.get(i)[0], GOLD, (String) todayEv.get(i)[1], false);
        if (todayEv.isEmpty() && evs != null) { line(sb, null, 0, "Сегодня событий нет", true); used++; }
        if (evs == null) { line(sb, null, 0, "Откройте приложение и разрешите доступ к календарю", true); used++; }
        if (!rems.isEmpty() && used < maxLines - 1) {
            header(sb, "Напоминания");
            used++;
            for (int i = 0; i < rems.size() && used < maxLines; i++, used++) {
                Object[] r = rems.get(i);
                line(sb, (String) r[0], (Boolean) r[2] ? RED : TEAL, (String) r[1], false);
            }
        }
        if (!tomorrowEv.isEmpty() && used < maxLines - 1) {
            header(sb, "Завтра");
            used++;
            for (int i = 0; i < tomorrowEv.size() && used < maxLines; i++, used++) line(sb, (String) tomorrowEv.get(i)[0], MUTED, (String) tomorrowEv.get(i)[1], false);
        }
        v.setTextViewText(R.id.w_body, sb);

        // нижняя строка: вода, калории, расходы месяца
        String key = Store.dayKey(now);
        JSONObject water = d.optJSONObject("water");
        int ml = water != null ? water.optInt(key, 0) : 0;
        int goal = st.optInt("waterGoal", 2000);
        int kcal = 0;
        JSONArray food = d.optJSONArray("food");
        if (food != null) for (int i = 0; i < food.length(); i++) {
            JSONObject f = food.optJSONObject(i);
            if (f != null && !f.optBoolean("deleted") && f.optLong("date") >= today && f.optLong("date") < tomorrow) kcal += f.optInt("kcal");
        }
        double spent = 0;
        Calendar m0 = (Calendar) now.clone();
        m0.set(Calendar.DAY_OF_MONTH, 1);
        m0.set(Calendar.HOUR_OF_DAY, 0);
        m0.set(Calendar.MINUTE, 0);
        m0.set(Calendar.SECOND, 0);
        m0.set(Calendar.MILLISECOND, 0);
        long monthStart = m0.getTimeInMillis();
        JSONArray money = d.optJSONArray("money");
        if (money != null) for (int i = 0; i < money.length(); i++) {
            JSONObject e = money.optJSONObject(i);
            if (e != null && !e.optBoolean("deleted") && "expense".equals(e.optString("type")) && e.optLong("date") >= monthStart) spent += e.optDouble("amount", 0);
        }
        String foot = "💧 " + liters(ml) + "/" + liters(goal) + " л   🍽 " + kcal + " ккал   −" + money(spent) + " " + cur + " в " + MONTHS_PREP[now.get(Calendar.MONTH)];
        v.setTextViewText(R.id.w_foot, foot);

        v.setOnClickPendingIntent(R.id.w_root, open(c, null, 10));
        v.setOnClickPendingIntent(R.id.w_body, open(c, null, 10));
        v.setOnClickPendingIntent(R.id.w_voice, open(c, "voice", 11));
        v.setOnClickPendingIntent(R.id.w_money, open(c, "expense", 12));
        v.setOnClickPendingIntent(R.id.w_add, open(c, "add", 13));
        v.setOnClickPendingIntent(R.id.w_foot, open(c, "health", 14));
        PendingIntent water1 = PendingIntent.getBroadcast(c, 15, new Intent(c, WidgetProvider.class).setAction(ACTION_WATER),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_water, water1);
        return v;
    }
}
