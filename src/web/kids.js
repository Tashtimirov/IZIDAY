// Обучение в детском режиме: карта по блокам, уроки с проверкой ответа, контрольные точки, темы оформления.
// Отдельный модуль поверх family.js: пользуется window.FAM и общими функциями приложения, сам family.js не меняет.
(function () {
  "use strict";
  const P = window.KIDS_PROGRAM;
  if (!P) return;
  document.addEventListener("DOMContentLoaded", () => {
    try {
      init();
    } catch (e) {
      console.error("kids", e);
    }
  });

  const IC = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    flag: '<path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>',
    chev: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    pig: '<path d="M4 12a7 6 0 0 1 7-6h3a6 6 0 0 1 5.5 3.5L21 10v4l-1.6.6A6 6 0 0 1 17 17v3h-3v-2h-3v2H8v-3a7 6 0 0 1-4-5z"/><path d="M15.5 10.5h.01"/>',
  };
  const ic = (n, s = 24, c = "currentColor", w = 2) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;
  const orb = (s = 72) => `<b class="orb kidorb" style="width:${s}px;height:${s}px"></b>`;
  const JARS = [
    ["spend", "Трачу", "bag", "#FF8A3D", "на мелочи сейчас"],
    ["save", "Коплю", "pig", "#18B57A", "на мечту"],
    ["share", "Делюсь", "gift", "#FF5FA2", "подарки, помощь"],
  ];
  const BURST = ["#0A9F6E", "#FF6FA8", "#6A4BF2", "#FFB547", "#2FB7FF", "#FF8A3D"];
  const THEMES = [
    ["space", "Космос", "#6A4BF2"],
    ["ocean", "Океан", "#1877D8"],
    ["forest", "Лес", "#0F8F63"],
    ["sunset", "Закат", "#E0562B"],
    ["berry", "Ягода", "#D6337F"],
  ];

  // ── данные семьи ──
  const on = () => !!(window.FAM && D.fam && D.fam.code && D.fam.url && D.fam.role === "kid");
  const me = () => D.fam.id;
  const logs = () => ((D.fam.data || {}).log || []).filter((x) => x && !x.del && x.kid === me());
  const age = () => +(((D.fam.data || {}).members || {})[me()] || {}).age || 10;
  const today = () => dayKey(new Date());
  const tier = () => P.tiers.filter((t) => age() >= t.from).pop();
  const L = (id) => FAM.LESSONS.find((l) => l.id === id);
  const done = (id) => logs().some((x) => x.kind === "lesson" && x.task === id && x.st === "ok");
  const quizOk = (b) => logs().some((x) => x.task === "cq:" + b.id && x.st === "ok");
  const deedSt = (b) => (logs().find((x) => x.task === "cd:" + b.id) || {}).st || "";
  const stepsOf = (l) => (age() < 11 && l.young) || l.steps;
  const deedOf = (b) => (age() < 11 && b.deedYoung) || b.deed;
  const cpPassed = (b) => !b.qs || (quizOk(b) && ["wait", "ok"].includes(deedSt(b)));

  // блоки дорожки для возраста ребёнка; у «Целей» и «Желаний» один блок без контрольной точки
  function blocksOf(c, all) {
    const own = P.blocks.filter((b) => b.c === c);
    if (own.length) return all ? own : own.filter((b) => !b.age || age() >= b.age);
    const ls = FAM.LESSONS.filter((l) => l.c === c && (!l.age || age() >= l.age)).map((l) => l.id);
    return ls.length ? [{ id: "x:" + c, c, t: (P.tracks.find((t) => t.id === c) || {}).t || "", lessons: ls }] : [];
  }
  const blockOf = (id) => {
    const l = L(id);
    return l && blocksOf(l.c).find((b) => b.lessons.includes(id));
  };
  const blockOpen = (b) => {
    const bs = blocksOf(b.c),
      i = bs.indexOf(b);
    return i <= 0 || cpPassed(bs[i - 1]);
  };
  const nextIn = (b) => b.lessons.find((id) => !done(id));
  const allDone = (b) => !nextIn(b);

  function burst() {
    const a = document.createElement("div");
    a.className = "kburst";
    for (let e = 0; e < 18; e++) {
      const s = document.createElement("i");
      s.style.cssText = `--x:${Math.cos((e / 18) * 6.28) * (60 + (e % 3) * 30)}px;--y:${Math.sin((e / 18) * 6.28) * (60 + (e % 3) * 30)}px;background:${BURST[e % BURST.length]}`;
      a.append(s);
    }
    document.body.append(a);
    setTimeout(() => a.remove(), 900);
  }

  // ── тема ──
  const theme = () => {
    try {
      return localStorage.getItem("izi-kth") || "space";
    } catch {
      return "space";
    }
  };
  function applyTheme() {
    const t = theme();
    if (document.body.classList.contains("kidm") && t !== "space") document.body.dataset.kth = t;
    else delete document.body.dataset.kth;
  }
  function pickTheme() {
    const s = sheet(
      `<h3>Мой цвет</h3><div class="kth-grid">${THEMES.map(
        ([id, n, c]) => `<button data-th="${id}" class="${theme() === id ? "on" : ""}"><i style="background:${c}"></i><span>${n}</span></button>`,
      ).join("")}</div>`,
    );
    s.el.classList.add("kid-sheet");
    $$("[data-th]", s.el).forEach(
      (b) =>
        (b.onclick = () => {
          try {
            localStorage.setItem("izi-kth", b.dataset.th);
          } catch {}
          s.close();
          applyTheme();
          render();
        }),
    );
  }

  // ── меню «Мне скучно» ──
  // Идеи и проекты лежат в общем журнале семьи (как уроки), поэтому видны на всех устройствах ребёнка.
  const ideas = () => logs().filter((x) => x.kind === "idea").sort((a, b) => (a.at || 0) - (b.at || 0));
  function addIdea(t) {
    t = String(t || "").trim().slice(0, 60);
    if (!t) return false;
    if (ideas().some((x) => x.title.toLowerCase() === t.toLowerCase())) return toast("Такое занятие уже есть"), false;
    FAM.put("log", { id: `id:${me()}:${uid("i")}`, kid: me(), task: "idea", title: t, day: today(), at: Date.now(), kind: "idea", st: "idea", stars: 0 });
    return true;
  }
  const hints = () => (P.ideaHints || []).filter((h) => !ideas().some((x) => x.title.toLowerCase() === h.toLowerCase()));
  // общий кусок: список идей, поле ввода и подсказки; используется и в уроке, и в самом меню
  function ideasHtml(pick) {
    const li = ideas();
    return `<div class="kl-ideas">${li.map((x) => `<span class="${pick === x.id ? "pick" : ""}">${esc(x.title)}<button data-idel="${esc(x.id)}" aria-label="Убрать">${ic("x", 14, "currentColor", 2.6)}</button></span>`).join("") || '<em>Пока пусто. Добавь первое занятие.</em>'}</div>
<div class="kl-add"><input data-iin maxlength="60" placeholder="Например: построить шалаш"><button data-iadd aria-label="Добавить">${ic("plus", 22, "#fff", 2.6)}</button></div>
<div class="kl-hints">${hints().slice(0, 5).map((h) => `<button data-ihint="${esc(h)}">${ic("plus", 14, "currentColor", 2.6)}${esc(h)}</button>`).join("")}</div>`;
  }
  function bindIdeas(o, redraw) {
    const inp = $("[data-iin]", o),
      add = () => {
        addIdea(inp.value) && redraw();
      };
    $("[data-iadd]", o).onclick = add;
    inp.onkeydown = (e) => {
      e.key === "Enter" && (e.preventDefault(), add());
    };
    $$("[data-ihint]", o).forEach((b) => (b.onclick = () => (addIdea(b.dataset.ihint), redraw())));
    $$("[data-idel]", o).forEach(
      (b) =>
        (b.onclick = () => {
          const x = ideas().find((i) => i.id === b.dataset.idel);
          x && FAM.put("log", Object.assign({}, x, { del: !0 }));
          redraw();
        }),
    );
  }
  function openBored() {
    const sh = sheet('<div class="klesson"></div>');
    sh.el.classList.add("kid-sheet", "kfull");
    const o = $(".klesson", sh.el);
    let pick = null;
    const draw = () => {
      const li = ideas(),
        p = li.find((x) => x.id === pick);
      o.innerHTML = `<div class="kl-cph">${ic("bolt", 22)}<b>Мне скучно</b><span>${li.length} ${plural(li.length, "занятие", "занятия", "занятий")}</span></div>
<div class="ksay">${orb(72)}<div class="kbub">${p ? `Как насчёт этого: «${esc(p.title)}»? Начни с маленького шага на 5 минут.` : li.length ? "Это твоё меню. Выбери занятие или доверься мне." : "Здесь будет твоё меню занятий. Запиши то, что тебе нравится делать без экрана."}</div></div>
${li.length ? `<button class="kbtn" data-a="roll">${p ? "Выбери другое" : "Выбери за меня"}</button>` : ""}${ideasHtml(pick)}`;
      bindIdeas(o, () => (draw(), render()));
      const r = $('[data-a="roll"]', o);
      r &&
        (r.onclick = () => {
          const rest = li.filter((x) => x.id !== pick);
          pick = (rest.length ? rest : li)[Math.floor(Math.random() * (rest.length || li.length))].id;
          draw();
        });
    };
    draw();
  }

  // ── «Мой проект» ──
  const projs = () => logs().filter((x) => x.kind === "proj").sort((a, b) => (b.at || 0) - (a.at || 0));
  const curProj = () => projs().find((x) => x.st !== "ok");
  const PSTEPS = ["Придумать и собрать, что нужно", "Сделать", "Доделать и украсить"];
  function openProj() {
    const sh = sheet('<div class="klesson"></div>');
    sh.el.classList.add("kid-sheet", "kfull");
    const o = $(".klesson", sh.el);
    const head = `<div class="kl-cph">${ic("flag", 22)}<b>Мой проект</b></div>`;
    let big = !1,
      nm = "";
    const fresh = () => {
      const weeks = age() < 11 ? 2 : 4;
      o.innerHTML =
        head +
        `<div class="ksay">${orb(72)}<div class="kbub">${big ? `Большой проект делают по неделям${age() < 11 ? ". План лучше составить вместе с мамой или папой" : ""}. После показа улучши одну вещь.` : "Что хочется сделать? Проект — это дело с результатом: открытка, игра, пирог, мультфильм."}</div></div>
<div class="kl-two kl-kind"><button data-pk="0" class="${big ? "" : "on"}">Маленький<small>день – неделя</small></button><button data-pk="1" class="${big ? "on" : ""}">Большой<small>${age() < 11 ? "2 недели" : "2–4 недели"}</small></button></div>
<div class="kl-form"><label>Мой проект</label><input data-pn maxlength="50" value="${esc(nm)}" placeholder="${big ? "Например: свой мультфильм" : "Например: настольная игра про котов"}">
<label>${big ? "Что сделать на каждой неделе" : "Три шага"}</label>${(big ? Array.from({ length: weeks }, (x, i) => `Неделя ${i + 1}`) : PSTEPS.map((t, i) => `${i + 1}. ${t}`)).map((t, i) => `<input data-ps="${i}" maxlength="60" placeholder="${t}">`).join("")}</div>
<div class="kl-err" data-err></div><button class="kbtn" data-a="mk">Начать проект</button>`;
      $$("[data-pk]", o).forEach(
        (b) =>
          (b.onclick = () => {
            nm = $("[data-pn]", o).value;
            big = b.dataset.pk === "1";
            fresh();
          }),
      );
      $('[data-a="mk"]', o).onclick = () => {
        const n = $("[data-pn]", o).value.trim(),
          err = $("[data-err]", o);
        if (!n) return (err.textContent = "Сначала напиши, что это будет."), $("[data-pn]", o).focus();
        let steps = $$("[data-ps]", o).map((e, i) => ({ t: e.value.trim() || (big ? "" : PSTEPS[i]), d: !1 }));
        if (big) {
          steps = steps.filter((x) => x.t);
          if (steps.length < 2) return (err.textContent = "Напиши, что сделать хотя бы на двух неделях."), $("[data-ps]", o).focus();
        }
        FAM.put("log", { id: `pj:${me()}:${uid("p")}`, kid: me(), task: "proj", name: n, title: (big ? "Большой проект: " : "Проект: ") + n, big, steps, day: today(), at: Date.now(), kind: "proj", st: "plan", stars: big ? P.stars.projBig : P.stars.proj });
        burst();
        draw();
        render();
      };
      $$("input", o).forEach((e) => (e.oninput = () => ($("[data-err]", o).textContent = "")));
    };
    const draw = () => {
      const p = curProj();
      if (!p) return fresh();
      const all = p.steps.every((x) => x.d),
        wait = p.st === "wait";
      let u = head + `<div class="kl-deed"><b>${esc(p.name)}</b>${p.big ? '<div class="kl-s">большой проект</div>' : ""}${p.steps.map((x, i) => `<button class="kl-pstep${x.d ? " on" : ""}" data-pt="${i}" ${wait ? "disabled" : ""}><span>${x.d ? ic("check", 16, "#fff", 3) : ""}</span>${esc(x.t)}</button>`).join("")}`;
      if (wait) u += `<div class="kl-st">${ic("clock", 16)}Ждёт показа семье</div>`;
      else if (p.st === "no") u += `<div class="kl-st no">Пока не принято. Доделай и покажи ещё раз.</div>`;
      u += `</div>`;
      u += `<div class="ksay">${orb(72)}<div class="kbub">${wait ? (p.big ? "Покажи проект семье и спроси: что понравилось и что сделать лучше? Улучши одну вещь — и родители примут проект у себя." : "Покажи проект маме или папе и расскажи, как всё получилось. Они отметят показ у себя.") : all ? "Все шаги сделаны! Пора показать семье." : "Отмечай шаги, когда сделаешь. Не получилось с первого раза — это первая версия."}</div></div>`;
      u += wait ? `<button class="kbtn" data-a="close">Понятно</button>` : `<button class="kbtn" data-a="show" ${all ? "" : "disabled"}>Показать семье · +${p.stars} звёзд</button><button class="klink" data-a="drop">Убрать проект</button>`;
      const ok = projs().filter((x) => x.st === "ok");
      if (ok.length) u += `<div class="kl-donep"><b>Готовые проекты</b>${ok.map((x) => `<span>${ic("check", 16, "#18B57A", 3)}${esc(x.name)}</span>`).join("")}</div>`;
      o.innerHTML = u;
      $$("[data-pt]", o).forEach(
        (b) =>
          (b.onclick = () => {
            const steps = p.steps.map((x, i) => (i === +b.dataset.pt ? Object.assign({}, x, { d: !x.d }) : x));
            FAM.put("log", Object.assign({}, p, { steps }));
            steps[+b.dataset.pt].d && burst();
            draw();
            render();
          }),
      );
      const c = $('[data-a="close"]', o),
        s = $('[data-a="show"]', o),
        d = $('[data-a="drop"]', o);
      c && (c.onclick = () => sh.close());
      s &&
        (s.onclick = () => {
          if (!all) return;
          FAM.put("log", Object.assign({}, p, { st: "wait", day: today(), at: Date.now() }));
          toast("Ждёт показа семье");
          draw();
          render();
        });
      d &&
        (d.onclick = async () => {
          if ((await ui.confirm("Убрать проект?", `<div class="msg">«${esc(p.name)}» исчезнет из списка.</div>`, ["Оставить", "Убрать"])) !== "Убрать") return;
          FAM.put("log", Object.assign({}, p, { del: !0 }));
          draw();
          render();
        });
    };
    draw();
  }
  function toolsHtml() {
    const n = ideas().length,
      p = curProj(),
      ok = projs().filter((x) => x.st === "ok").length;
    const ps = p ? (p.st === "wait" ? "ждёт показа семье" : `${p.steps.filter((x) => x.d).length} из ${p.steps.length} шагов`) : ok ? `готово: ${ok} · начать новый` : "придумай и начни";
    return `<div class="kl-tools"><button data-kl="bored"><span class="kl-ic">${ic("bolt", 24)}</span><b>Мне скучно</b><small>${n ? `${n} ${plural(n, "занятие", "занятия", "занятий")} в меню` : "собери своё меню"}</small></button>
<button data-kl="proj"><span class="kl-ic">${ic("flag", 24)}</span><b>${p ? esc(p.name) : "Мой проект"}</b><small>${ps}</small></button></div>`;
  }

  // ── карта ──
  let cur = "money";
  function mapHtml() {
    const stars = FAM.kidStars(me());
    let h = `<div class="kd kl-map"><div class="khd"><div class="grow"><div class="ks">${esc(tier().name)} · ${age()} ${plural(age(), "год", "года", "лет")}</div><h1>Моя карта</h1></div>
<button class="kl-th" data-kl="theme" aria-label="Мой цвет">${ic("palette", 24)}</button><span class="kstar">${ic("star", 16, "#E89A00", 2.4)}${num(stars)}</span></div>`;
    h += `<div class="kl-chips">${P.tracks
      .map((t) => `<button data-klt="${t.id}" class="${t.id === cur ? "on" : ""}${t.soon ? " soon" : ""}">${esc(t.t)}${t.soon ? " · скоро" : ""}</button>`)
      .join("")}</div>`;
    if (cur === "make") h += toolsHtml();
    const bs = blocksOf(cur);
    bs.forEach((b, bi) => {
      const open = blockOpen(b),
        nx = nextIn(b),
        n = b.lessons.filter(done).length;
      h += `<div class="kcard${open ? "" : " kl-off"}"><h2>${esc(b.t)}<span>${n} из ${b.lessons.length}</span></h2>`;
      if (!open) {
        h += `<div class="kl-row lock"><span class="kl-ic">${ic("lock", 22)}</span><div class="grow"><div class="kl-t">Пока закрыто</div><div class="kl-s">откроется после контрольной точки блока «${esc(bs[bi - 1].t)}»</div></div></div></div>`;
        return;
      }
      b.lessons.forEach((id) => {
        const l = L(id);
        if (!l) return;
        const d = done(id),
          now = id === nx;
        h += `<button class="kl-row ${d ? "done" : now ? "now" : "lock"}" data-kll="${id}"><span class="kl-ic">${ic(d ? "check" : now ? "play" : "lock", 22, "currentColor", d ? 3 : 2)}</span>
<div class="grow"><div class="kl-t">${esc(l.t)}</div><div class="kl-s">${d ? "пройден" : now ? `3 минуты · +${P.stars.lesson} звёзд` : "после предыдущего урока"}</div></div>${now ? ic("chev", 22) : ""}</button>`;
      });
      if (b.qs) {
        const q = quizOk(b),
          ds = deedSt(b),
          ready = allDone(b),
          full = q && ds === "ok";
        const sub = full
          ? `пройдена · значок «${esc(b.t)}»`
          : q && ds === "wait"
            ? "дело в жизни ждёт проверки родителя"
            : q && ds === "no"
              ? "дело не засчитано — попробуй ещё раз"
              : q
                ? `вопросы пройдены · осталось дело в жизни · +${P.stars.deed}`
                : ready
                  ? `${b.qs.length} вопросов и дело в жизни · +${P.stars.quiz + P.stars.deed}`
                  : "после всех уроков блока";
        h += `<button class="kl-row cp${full ? " done" : ready ? "" : " lock"}" data-klc="${b.id}"><span class="kl-ic">${ic(full ? "check" : q && ds === "wait" ? "clock" : ready ? "flag" : "lock", 22, "currentColor", full ? 3 : 2)}</span>
<div class="grow"><div class="kl-t">Контрольная точка</div><div class="kl-s">${sub}</div></div>${ready && !full ? ic("chev", 22) : ""}</button>`;
      }
      h += `</div>`;
    });
    const later = blocksOf(cur, true).filter((b) => b.age && age() < b.age);
    if (later.length)
      h += `<div class="kl-gift">${ic("gift", 22)}<div>С ${later[0].age} лет откроются блоки: ${later.map((b) => `«${esc(b.t)}»`).join(", ")}.</div></div>`;
    if (!bs.length) h += `<div class="kcard"><b>Этот раздел готовится</b><div class="kmuted">Уроки появятся здесь позже.</div></div>`;
    return h + `</div>`;
  }
  function bindMap(v) {
    $$("[data-klt]", v).forEach(
      (b) =>
        (b.onclick = () => {
          if (b.classList.contains("soon")) return toast("Этот раздел скоро появится");
          cur = b.dataset.klt;
          paint(true);
        }),
    );
    $$("[data-kll]", v).forEach((b) => (b.onclick = () => openLesson(b.dataset.kll)));
    $$("[data-klc]", v).forEach((b) => (b.onclick = () => openCp(P.blocks.find((x) => x.id === b.dataset.klc))));
    const t = $('[data-kl="theme"]', v),
      bo = $('[data-kl="bored"]', v),
      pr = $('[data-kl="proj"]', v);
    t && (t.onclick = pickTheme);
    bo && (bo.onclick = openBored);
    pr && (pr.onclick = openProj);
  }
  function paint(force) {
    applyTheme();
    if (!on() || !document.body.classList.contains("kidm")) return;
    const tabOn = $('#knav [data-kt="learn"].on');
    const v = $("#view");
    if (!tabOn || !v) return;
    const h = mapHtml();
    if (!force && v.dataset.kl === h && $(".kl-map", v)) return;
    v.innerHTML = h;
    v.dataset.kl = h;
    bindMap(v);
  }

  // ── урок ──
  function openLesson(id) {
    const l = L(id);
    if (!l) return;
    const b = blockOf(id);
    if (!done(id)) {
      if (b && !blockOpen(b)) return toast("Сначала пройди контрольную точку");
      if (b && nextIn(b) !== id) return toast("Сначала пройди предыдущий урок");
    }
    runLesson(l);
  }
  function runLesson(l) {
    const was = done(l.id),
      steps = stepsOf(l);
    let i = 0,
      pick = null,
      bad = new Set(),
      si = 0,
      sbad = false,
      jar = { spend: 0, save: 0, share: 0 };
    const sh = sheet('<div class="klesson"></div>');
    sh.el.classList.add("kid-sheet", "kfull");
    const o = $(".klesson", sh.el);
    const draw = () => {
      const c = steps[i],
        last = i === steps.length - 1;
      let u = `<div class="kprog"><div class="kbar"><i style="width:${Math.round(((i + 1) / steps.length) * 100)}%"></i></div><span>${i + 1} / ${steps.length}</span></div>`;
      u += `<div class="ksay">${orb(72)}<div class="kbub">${esc(c.say || c.q)}</div></div>`;
      let ready = true;
      if (c.q) {
        ready = pick != null;
        u += `<div class="kopts">${c.a.map((f, d) => `<button data-o="${d}" class="${d === pick ? "ok" : bad.has(d) ? "bad" : ""}">${esc(f)}</button>`).join("")}</div>`;
        if (pick != null) u += `<div class="kwhy ok">${ic("bulb", 26, "#18B57A")}<div>Верно! ${esc(c.why || "")}</div></div>`;
        else if (bad.size) u += `<div class="kwhy">${ic("bulb", 26, "#FF8A3D")}<div>Не совсем. Подумай и выбери ещё раз.</div></div>`;
      }
      if (c.sort) {
        ready = si >= c.sort.length;
        if (!ready) {
          const it = c.sort[si];
          u += `<div class="kl-item${sbad ? " bad" : ""}"><small>${si + 1} из ${c.sort.length}</small><b>${esc(it[0])}</b></div>
<div class="kl-two">${c.labels.map((x, d) => `<button data-s="${d}">${esc(x)}</button>`).join("")}</div>`;
          if (sbad) u += `<div class="kwhy">${ic("bulb", 26, "#FF8A3D")}<div>Не совсем. Попробуй ещё раз.</div></div>`;
          else if (si) u += `<div class="kwhy ok">${ic("bulb", 26, "#18B57A")}<div>Верно! ${esc(c.sort[si - 1][2] || "")}</div></div>`;
        } else u += `<div class="kwhy ok">${ic("bulb", 26, "#18B57A")}<div>Верно! ${esc(c.sort[si - 1][2] || "")} Всё разложено.</div></div>`;
      }
      if (c.ideas) {
        const n = ideas().length;
        ready = n >= c.n;
        u += ideasHtml() + `<div class="kwhy${ready ? " ok" : ""}">${ic("bulb", 26, ready ? "#18B57A" : "#FF8A3D")}<div>${ready ? `В меню уже ${n} ${plural(n, "занятие", "занятия", "занятий")}. Можно добавить ещё.` : `Нужно ещё ${c.n - n}.`}</div></div>`;
      }
      if (c.split) {
        const f = jar.spend + jar.save + jar.share;
        ready = f === 100;
        u += `<div class="kjars big">${JARS.map(
          ([d, p, r, hh, g]) =>
            `<button data-j="${d}" style="--c:${hh}"><span class="kjar" style="--f:${jar[d]}%">${ic(r, 30, jar[d] > 45 ? "#fff" : hh)}</span><b>${p}</b><em>${jar[d]}</em><small>${g}</small></button>`,
        ).join("")}</div><div class="kcoins">${Array.from({ length: (100 - f) / 10 }, () => "<i>10</i>").join("")}</div>`;
        if (ready)
          u += `<div class="kwhy ok">${ic("bulb", 26, "#18B57A")}<div>${jar.save >= 30 ? `Отлично! Если копить по ${jar.save} монет, мечта будет ближе с каждой неделей.` : "Готово! Но подумай: если в «Коплю» класть побольше, мечта сбудется быстрее."}</div></div><button class="klink" data-a="again">Разложить заново</button>`;
      }
      u += `<button class="kbtn" data-a="next" ${ready ? "" : "disabled"}>${last ? (was ? "Готово" : `Готово · +${P.stars.lesson} звёзд`) : "Дальше"}</button>`;
      o.innerHTML = u;
      $$("[data-o]", o).forEach(
        (f) =>
          (f.onclick = () => {
            if (pick != null) return;
            const d = +f.dataset.o;
            if (d === c.ok) (pick = d), burst();
            else bad.add(d);
            draw();
          }),
      );
      $$("[data-s]", o).forEach(
        (f) =>
          (f.onclick = () => {
            if (+f.dataset.s === c.sort[si][1]) si++, (sbad = false), si >= c.sort.length && burst();
            else sbad = true;
            draw();
          }),
      );
      $$("[data-j]", o).forEach(
        (f) =>
          (f.onclick = () => {
            jar.spend + jar.save + jar.share < 100 && ((jar[f.dataset.j] += 10), draw());
          }),
      );
      c.ideas && bindIdeas(o, draw);
      const ag = $('[data-a="again"]', o);
      ag && (ag.onclick = () => ((jar = { spend: 0, save: 0, share: 0 }), draw()));
      $('[data-a="next"]', o).onclick = () => {
        if (!ready) return;
        if (!last) {
          i++, (pick = null), (bad = new Set()), (si = 0), (sbad = false);
          draw();
          return;
        }
        if (!was) {
          FAM.put("log", { id: `ls:${me()}:${l.id}`, kid: me(), task: l.id, title: "Урок: " + l.t, day: today(), at: Date.now(), kind: "lesson", st: "ok", stars: P.stars.lesson });
          burst();
          toast(`+${P.stars.lesson} звёзд`);
        }
        sh.close();
        render();
      };
    };
    draw();
  }

  // ── контрольная точка ──
  const fails = () => {
    try {
      return JSON.parse(localStorage.getItem("izi-kq") || "{}");
    } catch {
      return {};
    }
  };
  function openCp(b) {
    if (!b) return;
    if (!blockOpen(b)) return toast("Сначала пройди контрольную точку");
    if (!allDone(b)) return toast("Сначала пройди все уроки блока");
    const sh = sheet('<div class="klesson"></div>');
    sh.el.classList.add("kid-sheet", "kfull");
    const o = $(".klesson", sh.el);
    const qs = (age() >= 11 && b.qs11) || b.qs;
    let i = 0,
      pick = null,
      right = 0;
    const head = `<div class="kl-cph">${ic("flag", 22)}<b>Контрольная точка</b><span>${esc(b.t)}</span></div>`;
    const deed = () => {
      const ds = deedSt(b);
      let u = head + `<div class="ksay">${orb(72)}<div class="kbub">${quizOk(b) ? "Вопросы пройдены! Осталось дело в жизни." : ""}</div></div>`;
      u += `<div class="kl-deed"><div class="krow"><span class="kl-ic">${ic("home", 22)}</span><div class="grow"><b>Дело в жизни</b><div class="kl-s">+${P.stars.deed} звёзд, когда родитель примет</div></div></div><p>${esc(deedOf(b))}</p>`;
      if (ds === "ok") u += `<div class="kl-st ok">${ic("check", 16, "currentColor", 3)}Принято · +${P.stars.deed} звёзд</div>`;
      else if (ds === "wait") u += `<div class="kl-st">${ic("clock", 16)}Ждёт проверки родителя</div>`;
      else if (ds === "no") u += `<div class="kl-st no">Пока не засчитано. Сделай ещё раз и отправь снова.</div>`;
      u += `</div>`;
      if (ds === "ok") u += `<div class="kwhy ok">${ic("star", 26, "#E89A00")}<div>Блок «${esc(b.t)}» пройден целиком. У тебя новый значок!</div></div>`;
      u += ds === "ok" || ds === "wait" ? `<button class="kbtn" data-a="close">Понятно</button>` : `<button class="kbtn" data-a="send">Готово, отправить на проверку</button><button class="klink" data-a="close">Сделаю позже</button>`;
      o.innerHTML = u;
      const c = $('[data-a="close"]', o),
        s = $('[data-a="send"]', o);
      c && (c.onclick = () => (sh.close(), render()));
      s &&
        (s.onclick = () => {
          FAM.put("log", { id: `cd:${me()}:${b.id}`, kid: me(), task: "cd:" + b.id, title: "Дело в жизни: " + deedOf(b), day: today(), at: Date.now(), kind: "deed", st: "wait", stars: P.stars.deed });
          toast("Ждёт проверки");
          deed();
          render();
        });
    };
    const result = () => {
      if (right >= P.pass) {
        FAM.put("log", { id: `cq:${me()}:${b.id}`, kid: me(), task: "cq:" + b.id, title: "Контрольная точка: " + b.t, day: today(), at: Date.now(), kind: "check", st: "ok", stars: P.stars.quiz });
        burst();
        toast(`+${P.stars.quiz} звёзд`);
        render();
        return deed();
      }
      const f = fails();
      f[me() + ":" + b.id] = today();
      try {
        localStorage.setItem("izi-kq", JSON.stringify(f));
      } catch {}
      o.innerHTML =
        head +
        `<div class="ksay">${orb(72)}<div class="kbub">Верно ${right} из ${qs.length}. Для зачёта нужно ${P.pass}. Это не страшно: повтори уроки блока и приходи завтра.</div></div><button class="kbtn" data-a="close">Понятно</button>`;
      $('[data-a="close"]', o).onclick = () => sh.close();
    };
    const quiz = () => {
      const c = qs[i];
      let u = head + `<div class="kprog"><div class="kbar"><i style="width:${Math.round(((i + 1) / qs.length) * 100)}%"></i></div><span>${i + 1} / ${qs.length}</span></div>`;
      u += `<div class="ksay">${orb(72)}<div class="kbub">${esc(c.q)}</div></div>`;
      u += `<div class="kopts">${c.a.map((f, d) => `<button data-o="${d}" class="${pick == null ? "" : d === c.ok ? "ok" : d === pick ? "bad" : ""}">${esc(f)}</button>`).join("")}</div>`;
      if (pick != null)
        u += `<div class="kwhy ${pick === c.ok ? "ok" : ""}">${ic("bulb", 26, pick === c.ok ? "#18B57A" : "#FF8A3D")}<div>${pick === c.ok ? "Верно! " : "Правильный ответ другой. "}${esc(c.why || "")}</div></div>`;
      u += `<button class="kbtn" data-a="next" ${pick == null ? "disabled" : ""}>${i === qs.length - 1 ? "Узнать результат" : "Дальше"}</button>`;
      o.innerHTML = u;
      $$("[data-o]", o).forEach(
        (f) =>
          (f.onclick = () => {
            if (pick != null) return;
            pick = +f.dataset.o;
            pick === c.ok && right++;
            quiz();
          }),
      );
      $('[data-a="next"]', o).onclick = () => {
        if (pick == null) return;
        if (i < qs.length - 1) {
          i++, (pick = null);
          return quiz();
        }
        result();
      };
    };
    if (quizOk(b)) return deed();
    if (fails()[me() + ":" + b.id] === today()) {
      o.innerHTML = head + `<div class="ksay">${orb(72)}<div class="kbub">Сегодня попытка уже была. Повтори уроки блока и приходи завтра.</div></div><button class="kbtn" data-a="close">Понятно</button>`;
      $('[data-a="close"]', o).onclick = () => sh.close();
      return;
    }
    o.innerHTML =
      head +
      `<div class="ksay">${orb(72)}<div class="kbub">Сейчас будет ${qs.length} вопросов по блоку. Для зачёта нужно ${P.pass} верных. Отвечай не спеша: у каждого вопроса одна попытка.</div></div><button class="kbtn" data-a="go">Начать</button>`;
    $('[data-a="go"]', o).onclick = quiz;
  }

  // ── подключение ──
  function init() {
    if (typeof D === "undefined" || typeof render !== "function" || !window.FAM) return;
    // программа «Деньги» заменяет старые уроки о деньгах; id прежних уроков сохранены, прогресс не теряется
    const LS = FAM.LESSONS;
    for (let i = LS.length - 1; i >= 0; i--) LS[i].c === "money" && LS.splice(i, 1);
    P.lessons.forEach((l) => LS.push(l));
    for (const id in P.patch) {
      const l = L(id);
      if (l) for (const n in P.patch[id]) l.steps[+n] && (l.steps[+n] = P.patch[id][n]);
    }
    const prev = render;
    render = function () {
      const r = prev.apply(this, arguments);
      try {
        paint();
      } catch (e) {
        console.error("kids", e);
      }
      return r;
    };
    // «Урок дня» и любые другие входы в урок идут через новый урок с проверкой ответа
    document.addEventListener(
      "click",
      (e) => {
        const b = e.target.closest && e.target.closest("[data-kles]");
        if (!b || !on()) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        openLesson(b.dataset.kles);
      },
      true,
    );
    window.KIDS = { openLesson, openCp, openBored, openProj, paint, pickTheme };
    render();
  }
})();
