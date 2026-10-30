/* =========================================================
   小账本 · 存钱页
   目标环 / 存一笔 / 四宫格 / 存款曲线 / 流水 / 目标管理
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;
  var C = App.calc;
  var S = App.store;
  var A = App.actions;

  var sMode = 'in';
  var locked = false;
  var bound = false;
  var els = {};

  function init() {
    els.goal = document.getElementById('goalCard');
    els.form = document.getElementById('savingForm');
    els.seg = document.getElementById('savingTypeSeg');
    els.amount = document.getElementById('savingAmount');
    els.note = document.getElementById('savingNote');
    els.date = document.getElementById('savingDate');
    els.save = document.getElementById('savingSaveBtn');
    els.stats = document.getElementById('savingsStats');
    els.chart = document.getElementById('savingsChartCard');
    els.list = document.getElementById('savingsListCard');
    els.manage = document.getElementById('goalManageCard');

    if (!els.date.value) els.date.value = U.todayStr();

    if (bound) return;
    bound = true;

    App.ui.bindAmountInput(els.amount);
    els.amount.addEventListener('input', function () {
      els.save.disabled = locked || !U.parseAmount(els.amount.value);
    });

    els.seg.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-stype]');
      if (!btn) return;
      sMode = btn.getAttribute('data-stype');
      renderMode();
    });

    els.form.addEventListener('submit', onSubmit);

    els.goal.addEventListener('click', onGoalAction);
    els.manage.addEventListener('click', onGoalAction);

    els.list.addEventListener('click', function (e) {
      var row = e.target.closest('[data-sid]');
      if (!row) return;
      var item = S.state.savings.filter(function (x) { return x.id === row.getAttribute('data-sid'); })[0];
      if (item) openSaving(item);
    });

    renderMode();
  }

  function renderMode() {
    els.seg.querySelectorAll('[data-stype]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-stype') === sMode);
    });
    els.form.classList.toggle('mode-out', sMode === 'out');
    els.save.textContent = sMode === 'in' ? '存进去' : '取出来';
    els.save.disabled = locked || !U.parseAmount(els.amount.value);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (locked) return;

    var amount = U.parseAmount(els.amount.value);
    if (!amount) {
      App.ui.toast('先填一个有效的金额');
      els.amount.focus();
      return;
    }
    var date = U.isDate(els.date.value) ? els.date.value : U.todayStr();

    locked = true;
    els.save.disabled = true;

    A.addSaving({ type: sMode, amount: amount, date: date, note: els.note.value });
    App.ui.toast(sMode === 'in' ? '存下 ¥' + U.money(amount) : '取出 ¥' + U.money(amount));
    els.amount.value = '';
    els.note.value = '';
    els.amount.blur();

    setTimeout(function () {
      locked = false;
      renderMode();
    }, 320);

    App.refreshAll();
  }

  function openSaving(item) {
    var sub = U.mdLabel(item.date) + ' ' + U.weekdayCn(item.date) + (item.note ? ' · ' + item.note : '');
    App.ui.actionSheet(
      (item.type === 'in' ? '+' : '-') + '¥' + U.money(item.amount),
      sub,
      [{
        label: '删除这笔', icon: 'i-trash', danger: true,
        onClick: function () {
          App.ui.confirm({
            title: '删除这笔存钱记录？',
            text: '删除后当前存款和目标进度会一起变化。',
            okText: '删除',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            var removed = A.removeSaving(item.id);
            App.refreshAll();
            App.ui.toast('已删除', {
              actionLabel: '撤销',
              onAction: function () { A.restoreSaving(removed); App.refreshAll(); }
            });
          });
        }
      }]
    );
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!els.form) init();
    renderGoal();
    renderStats();
    renderChart();
    renderList();
    renderManage();
    renderMode();
  }

  function renderGoal() {
    var p = C.goalProgress();
    if (!p) {
      els.goal.innerHTML =
        '<div class="card goal-card goal-empty">' +
          '<span class="goal-empty-ico">' + U.ico('i-piggy', 'lg') + '</span>' +
          '<h3>定一个存钱目标</h3>' +
          '<p>比如「旅行基金 30000」，之后每次存钱都看得见进度。</p>' +
          '<button class="btn primary block" type="button" data-act="new">设个目标</button>' +
        '</div>';
      return;
    }

    var pctText = Math.round(p.pct);
    var statusPill = p.achieved
      ? '<span class="pill ok">已达成</span>'
      : '<span class="pill">进行中</span>';

    var foot = '';
    if (p.achieved) {
      foot =
        '<div class="goal-done">' + U.ico('i-spark') + '目标达成！已存 ¥' + U.money(p.saved) + '</div>' +
        '<div class="goal-foot">' +
          '<button class="btn primary" type="button" data-act="raise">调高目标继续存</button>' +
          '<button class="btn" type="button" data-act="reset">重新设个目标</button>' +
        '</div>';
    }

    els.goal.innerHTML =
      '<div class="card goal-card' + (p.achieved ? ' is-done' : '') + '">' +
        '<div class="goal-top">' +
          '<div class="ring">' + App.chart.ring(p.pct) +
            '<div class="ring-txt"><b>' + pctText + '%</b><span>进度</span></div>' +
          '</div>' +
          '<div class="goal-info">' +
            '<div class="goal-name">' + U.esc(p.goal.name) + statusPill + '</div>' +
            '<div class="goal-num" title="¥' + U.money(p.saved) + '">' +
              '<span class="cny">¥</span>' + U.moneyShort(p.saved) +
              '<span class="goal-of">/ ' + U.moneyShort(p.target) + '</span>' +
            '</div>' +
            '<div class="goal-sub">' + (p.remaining > 0
              ? '还差 ¥' + U.money(p.remaining)
              : '目标金额已存满') + '</div>' +
            '<div class="goal-sub">' + U.esc(p.etaText) + '</div>' +
            (p.deadline ? '<div class="goal-sub">目标日期 ' + U.ymLabel(p.deadline.slice(0, 7)) + '</div>' : '') +
          '</div>' +
        '</div>' +
        foot +
      '</div>';
  }

  function renderStats() {
    var ym = U.currentYm();
    var ss = C.savingsSummary(ym);
    var cells = [
      { label: '本月存入', val: ss.monthIn, cls: 'income', icon: 'i-plus' },
      { label: '本月取出', val: ss.monthOut, cls: 'expense', icon: 'i-minus' },
      { label: '累计存入', val: ss.totalIn, cls: '', icon: 'i-download' },
      { label: '当前存款', val: ss.balance, cls: 'net', icon: 'i-piggy' }
    ];

    els.stats.innerHTML = cells.map(function (c) {
      return '<div class="stat ' + c.cls + '">' +
        '<div class="st-label">' + U.ico(c.icon) + c.label + '</div>' +
        '<div class="st-val" title="¥' + U.money(c.val) + '">' + U.moneyShort(c.val) + '</div>' +
        '<div class="st-sub">&nbsp;</div>' +
      '</div>';
    }).join('');
  }

  function renderChart() {
    var points = C.savingsSeries(U.currentYm(), 6);
    var p = C.goalProgress();
    var hasData = S.state.savings.length > 0 || S.state.settings.startBalance > 0;

    els.chart.innerHTML =
      '<div class="card-head">' +
        '<h2>存款曲线</h2>' +
        '<span class="head-sub">近 6 个月累计</span>' +
      '</div>' +
      '<div class="chart-box">' +
        (hasData
          ? App.chart.areaChart(points, { target: p ? p.target : null })
          : App.chart.empty('存上几笔，就能看到曲线了')) +
      '</div>';
  }

  function renderList() {
    var ym = U.currentYm();
    var list = S.state.savings.filter(function (x) { return U.ymOf(x.date) === ym; });
    var groups = C.groupSavingsByDay(list);

    var body;
    if (!groups.length) {
      body = '<div class="empty">这个月还没有存钱记录。</div>';
    } else {
      body = groups.map(function (g) {
        var head = [];
        if (g.inSum) head.push('存入 ¥' + U.money(g.inSum));
        if (g.outSum) head.push('取出 ¥' + U.money(g.outSum));

        return '<div class="day-head"><span>' + U.mdLabel(g.date) + ' ' + U.weekdayCn(g.date) + '</span>' +
          '<span>' + head.join(' · ') + '</span></div>' +
          g.items.map(function (x) {
            var isIn = x.type === 'in';
            return '<button class="rec" type="button" data-sid="' + U.esc(x.id) + '">' +
              '<span class="rec-ico' + (isIn ? ' income' : '') + '">' +
                U.ico(isIn ? 'i-plus' : 'i-minus') + '</span>' +
              '<span class="rec-main">' +
                '<span class="rec-title">' + U.esc(x.note || (isIn ? '存入' : '取出')) + '</span>' +
                '<span class="rec-meta">' + U.esc(U.relDay(x.date)) + '</span>' +
              '</span>' +
              '<span class="rec-amt ' + (isIn ? 'pos' : 'neg') + '">' +
                (isIn ? '+' : '-') + '¥' + U.money(x.amount) + '</span>' +
            '</button>';
          }).join('');
      }).join('');
    }

    els.list.innerHTML =
      '<div class="card-head"><h2>存钱流水</h2>' +
        '<span class="head-sub">本月 ' + list.length + ' 笔</span></div>' + body;
  }

  function renderManage() {
    var st = S.state;
    if (!st.goal && !st.goalHistory.length) {
      els.manage.innerHTML = '';
      return;
    }

    var history = st.goalHistory.map(function (h) {
      var when = (h.achievedAt || h.archivedAt || '').slice(0, 10);
      return '<div class="hist-item">' +
        '<div class="hist-main">' +
          '<b>' + U.esc(h.name) + '</b>' +
          '<span>目标 ¥' + U.money(h.targetAmount) + ' · ' + (h.status === 'achieved' ? '已达成' : '已归档') +
            (h.savedAmount ? ' · 存到 ¥' + U.money(h.savedAmount) : '') + '</span>' +
        '</div>' +
        '<div class="hist-date">' + U.esc(when) + '</div>' +
      '</div>';
    }).join('');

    var actionsHtml = st.goal
      ? '<div class="manage-row">' +
          '<button class="btn" type="button" data-act="edit">调整目标</button>' +
          '<button class="btn" type="button" data-act="reset">重新设个目标</button>' +
        '</div>'
      : '';

    els.manage.innerHTML =
      '<div class="card-head"><h2>目标管理</h2></div>' +
      actionsHtml +
      (st.goalHistory.length
        ? '<details class="fold history"><summary>历史目标' +
            '<span class="count-badge">' + st.goalHistory.length + '</span>' +
            '<span class="chev">' + U.ico('i-chev-down') + '</span></summary>' +
            '<div class="fold-body">' + history + '</div></details>'
        : '');
  }

  /* ---------- 目标操作 ---------- */
  function onGoalAction(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'new') openGoalForm('new');
    else if (act === 'reset') openGoalForm('reset');
    else if (act === 'edit') openGoalForm('edit');
    else if (act === 'raise') openGoalForm('raise');
  }

  function openGoalForm(formMode) {
    var g = S.state.goal;
    var isNew = formMode === 'new';
    var isReset = formMode === 'reset';
    var isRaise = formMode === 'raise';
    var title = isNew ? '设个存钱目标' : isReset ? '重新设个目标' : isRaise ? '调高目标' : '调整目标';

    var name = g ? g.name : '';
    var target = g ? g.targetAmount : 0;
    var deadline = g && g.deadline ? g.deadline : '';

    var html =
      '<div class="field"><label>目标名称</label>' +
        '<input id="goalName" type="text" maxlength="12" autocomplete="off" placeholder="旅行基金 / 应急金…" value="' + U.esc(name) + '"' +
        (isNew || isReset ? '' : ' readonly') + '>' +
      '</div>' +
      '<div class="field"><label>目标金额</label>' +
        '<div class="inp-wrap has-pre"><span class="pre">¥</span>' +
        '<input id="goalAmount" type="text" inputmode="decimal" maxlength="12" placeholder="0.00" value="' + (target ? U.yuanInput(target) : '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>目标日期（选填）</label>' +
        '<input id="goalDeadline" type="date" value="' + U.esc(deadline) + '">' +
      '</div>' +
      (isReset
        ? '<p class="hint-block">当前存款 ¥' + U.money(C.savingsBalance()) + '，新目标从这笔钱起算，之前的存款不重复计入进度。</p>'
        : isNew
          ? '<label class="check"><input type="checkbox" id="goalFromNow">' +
              '<span>从当前存款起算（当前 ¥' + U.money(C.savingsBalance()) + ' 不计入进度）</span></label>'
          : isRaise
            ? '<p class="hint-block">已存 ¥' + U.money(C.savingsBalance()) +
                '，累计不会清零；改成更大的数字就能接着存。</p>'
            : '') +
      '<button class="btn primary block" type="button" id="goalSave">' + (isRaise ? '调高目标' : '保存目标') + '</button>';

    var s = App.ui.sheet({ title: title, html: html });
    var amountInp = s.body.querySelector('#goalAmount');
    App.ui.bindAmountInput(amountInp);

    s.body.querySelector('#goalSave').onclick = function () {
      var targetAmount = U.parseAmount(amountInp.value);
      if (!targetAmount) { App.ui.toast('目标金额要大于 0'); amountInp.focus(); return; }

      var payload = {
        name: s.body.querySelector('#goalName').value.trim() || '存钱目标',
        targetAmount: targetAmount,
        deadline: s.body.querySelector('#goalDeadline').value || null
      };

      if (isRaise || formMode === 'edit') {
        A.updateGoal(payload);
        App.ui.toast(isRaise ? '目标已调高，接着存吧' : '目标已更新');
      } else {
        var fromNow = isReset ? true : s.body.querySelector('#goalFromNow').checked;
        payload.fromNow = fromNow;
        if (isReset) A.resetGoal(payload);
        else A.setGoal(payload);
        App.ui.toast(isReset ? '新目标已设好' : '目标已设好，开始存吧');
      }

      s.close();
      App.refreshAll();
    };

    setTimeout(function () {
      if (isNew || isReset) s.body.querySelector('#goalName').focus();
      else amountInp.focus();
    }, 260);
  }

  App.views = App.views || {};
  App.views.savings = {
    init: init,
    render: render
  };
})(window.App);
