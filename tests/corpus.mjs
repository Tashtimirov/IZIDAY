// Фразы и ожидаемый результат. «Сейчас» в тестах: чт 22.10.2026 20:00 (Бангкок).
// kinds — типы действий по порядку; extra — проверки отдельных полей (строка "kind:поле=значение").
export const CORPUS = [
  // перенос
  { t: "Перенеси свидание завтрашнее с 6 вечера на 8", kinds: ["move"], extra: ["move:query=свидание", "move:from=23.10 18:00", "move:to=20:00"] },
  { t: "перенеси созвон с Кириллом на пятницу в 15", kinds: ["move"], extra: ["move:query=созвон с кириллом", "move:to=пт 23.10 15:00"] },
  { t: "сдвинь йогу на час позже", kinds: ["move"], extra: ["move:query=йогу", "move:shift=60"] },
  { t: "перенеси свидание", kinds: ["move"], extra: ["move:query=свидание", "move:to=?"] },
  { t: "передвинь встречу с Олей на завтра", kinds: ["move"], extra: ["move:to=пт 23.10"] },
  // вопросы
  { t: "что у меня завтра", kinds: ["query"], extra: ["query:topic=schedule", "query:day=23.10"] },
  { t: "какие планы на субботу?", kinds: ["query"], extra: ["query:topic=schedule", "query:day=24.10"] },
  { t: "сколько я потратил в этом месяце", kinds: ["query"], extra: ["query:topic=money"] },
  { t: "сколько ушло на такси", kinds: ["query"], extra: ["query:topic=money", "query:category=Транспорт"] },
  { t: "когда у меня падел", kinds: ["query"], extra: ["query:topic=when", "query:q=падел"] },
  // выполнено
  { t: "хлеб купил", kinds: ["done"], extra: ["done:query=хлеб"] },
  { t: "отметь выполненным позвонить маме", kinds: ["done"], extra: ["done:query=позвонить маме"] },
  { t: "сделал отчёт для Кирилла", kinds: ["done"] },
  // время словами и прилагательные
  { t: "напомни завтра в половине восьмого выпить витамины", kinds: ["reminder"], extra: ["reminder:date=пт 23.10 07:30"] },
  { t: "встреча с Олей в пятницу без четверти семь вечера", kinds: ["event"], extra: ["event:date=пт 23.10 18:45"] },
  { t: "напомни вечером позвонить маме", kinds: ["reminder"], extra: ["reminder:date=чт 22.10 21:00"] },
  { t: "напомни утром купить воду", kinds: ["reminder"], extra: ["reminder:date=пт 23.10 09:00"] },
  { t: "ужин с Аней в следующую пятницу в 8", kinds: ["event"], extra: ["event:date=пт 30.10 20:00"] },
  { t: "сегодняшний созвон в 21", kinds: ["event"], extra: ["event:date=чт 22.10 21:00"] },
  { t: "встреча с риелтором в 8:30 утра послезавтра", kinds: ["event"], extra: ["event:date=сб 24.10 08:30"] },
  { t: "свидание завтра с 6 вечера", kinds: ["event"], extra: ["event:date=пт 23.10 18:00"] },
  { t: "в обед встреча с командой", kinds: ["event"], extra: ["event:date=пт 23.10 13:00"] },
  // деньги — то, что работало, не должно сломаться
  { t: "Купил продукты в макро на 845 бат картой и ещё 120 на кофе наличными", kinds: ["expense", "expense"] },
  { t: "Получил зарплату 45000 переводом и заплатил аренду 12000", kinds: ["income", "expense"] },
  { t: "Потратил триста пятьдесят бат на кофе наличными", kinds: ["expense"], extra: ["expense:amount=350"] },
  { t: "Добавь турнир по паделу по средам с семи до девяти и убери падел по вторникам", kinds: ["event", "delete"] },
  { t: "Завтра в 10 встреча с Олей, потратил 300 бат на такси наличными и напомни в 18 купить цветы", kinds: ["event", "expense", "reminder"] },
  { t: "Идея сделать сайт для кафе", kinds: ["note"] },
  // выбор календаря
  { t: "добавь в семейный календарь ужин у мамы в субботу в 7", kinds: ["event"], extra: ["event:calendar=семейная группа", "event:title=ужин у мамы", "event:date=сб 24.10 19:00"] },
  { t: "календарь семья день рождения Ани 5 ноября в 15", kinds: ["event"], extra: ["event:calendar=семейная группа", "event:title=день рождения ани"] },
  { t: "встреча с клиентом завтра в 11 в рабочий календарь", kinds: ["event"], extra: ["event:calendar=ptp", "event:title=встреча с клиентом", "event:date=пт 23.10 11:00"] },
  { t: "питипи созвон с командой в понедельник в 10", kinds: ["event"], extra: ["event:calendar=ptp", "event:title=созвон с командой"] },
  { t: "показ квартиры в пятницу в 14 календарь PTP", kinds: ["event"], extra: ["event:calendar=ptp", "event:title=показ квартиры"] },
  { t: "встреча с Олей завтра в 10", kinds: ["event"], extra: ["event:calendar=?"] },
  { t: "напомни в семейном календаре купить торт завтра", kinds: ["reminder"], extra: ["reminder:list=семья", "reminder:title=купить торт"] },
  { t: "ужин с семьёй в 8", kinds: ["event"], extra: ["event:calendar=?"] },
]
