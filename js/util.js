/* =========================================================
   小账本 · 工具层
   日期 / 金额（整数分）/ 分类表 / 格式化
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var WEEKS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- 日期 ---------- */
  function dateStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function todayStr() { return dateStr(new Date()); }
  function currentYm() { return todayStr().slice(0, 7); }
  function ymOf(ds) { return String(ds || '').slice(0, 7); }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
  function isYm(s) { return /^\d{4}-\d{2}$/.test(s || ''); }

  function ymLabel(ym) { return ym.slice(0, 4) + '年' + parseInt(ym.slice(5, 7), 10) + '月'; }
  function ymShort(ym) { return parseInt(ym.slice(5, 7), 10) + '月'; }

  function shiftYm(ym, delta) {
    var y = parseInt(ym.slice(0, 4), 10);
    var m = parseInt(ym.slice(5, 7), 10) - 1 + delta;
    var d = new Date(y, m, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function daysInYm(ym) {
    var y = parseInt(ym.slice(0, 4), 10);
    var m = parseInt(ym.slice(5, 7), 10);
    return new Date(y, m, 0).getDate();
  }

  function dayNum(ds) {
    var p = String(ds).split('-');
    return Math.floor(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)) / 86400000);
  }

  function weekdayCn(ds) {
    if (!isDate(ds)) return '';
    var p = ds.split('-');
    return WEEKS[new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getDay()];
  }

  function mdLabel(ds) { return parseInt(ds.slice(5, 7), 10) + '月' + parseInt(ds.slice(8, 10), 10) + '日'; }

  function relDay(ds) {
    if (!isDate(ds)) return '';
    var diff = dayNum(ds) - dayNum(todayStr());
    if (diff === 0) return '今天';
    if (diff === -1) return '昨天';
    if (diff === 1) return '明天';
    if (ds.slice(0, 4) === todayStr().slice(0, 4)) return mdLabel(ds);
    return ds.slice(0, 4) + '年' + mdLabel(ds);
  }

  function nowIso() { return new Date().toISOString(); }

  /* ---------- 金额（单位：分） ---------- */
  function money(fen) {
    var neg = fen < 0;
    var abs = Math.abs(Math.round(fen || 0));
    var yuan = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + yuan + '.' + pad2(abs % 100);
  }

  /* 紧凑显示：超过 1 万用「万」，用于三/四宫格 */
  function moneyShort(fen) {
    var v = (fen || 0) / 100;
    var a = Math.abs(v);
    if (a >= 10000) {
      var w = v / 10000;
      var s = Math.abs(w) >= 100
        ? w.toFixed(0)
        : w.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      return s + '万';
    }
    return money(fen).replace(/\.00$/, '');
  }

  /* 回填输入框：不带千分位，整数不补小数点 */
  function yuanInput(fen) {
    var v = Math.abs(Math.round(fen || 0)) / 100;
    return v.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  /* 解析输入框金额 -> 分；非法返回 null */
  function parseAmount(raw) {
    if (raw == null) return null;
    var s = String(raw).replace(/[¥￥,\s]/g, '');
    if (s === '' || s === '.') return null;
    if (!/^\d{0,8}(\.\d{0,2})?$/.test(s)) return null;
    var v = Math.round(parseFloat(s) * 100);
    if (!isFinite(v) || v <= 0 || v > 999999999) return null; // 上限 9,999,999.99 元
    return v;
  }

  /* 实时过滤非法字符，最多两位小数 */
  function cleanAmount(raw) {
    var s = String(raw == null ? '' : raw).replace(/[^\d.]/g, '');
    var i = s.indexOf('.');
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    var parts = s.split('.');
    parts[0] = parts[0].slice(0, 7);
    if (parts.length > 1) parts[1] = parts[1].slice(0, 2);
    s = parts.join('.');
    if (s.charAt(0) === '.') s = '0' + s;
    return s;
  }

  function clamp(n, min, max) { return n < min ? min : (n > max ? max : n); }
  function sum(list, fn) {
    var t = 0;
    for (var i = 0; i < list.length; i++) t += fn ? fn(list[i], i) : list[i];
    return t;
  }

  function uid(prefix) {
    return (prefix || 'p') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ico(name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#' + name + '"/></svg>';
  }

  function bytes(n) {
    if (!n || n < 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /* ---------- 分类表 ---------- */
  /* 支出 8 类 + 收入 4 类；顺序决定记账页分类格与环形图的取色顺序 */
  var EXPENSE_CATS = [
    { id: 'food', name: '餐饮', icon: 'i-bowl' },
    { id: 'daily', name: '日常', icon: 'i-cart' },
    { id: 'shop', name: '购物', icon: 'i-bag' },
    { id: 'traffic', name: '交通', icon: 'i-bus' },
    { id: 'social', name: '社交', icon: 'i-people' },
    { id: 'fun', name: '娱乐', icon: 'i-game' },
    { id: 'pet', name: '宠物', icon: 'i-paw' },
    { id: 'medical', name: '医疗', icon: 'i-med' }
  ];
  var INCOME_CATS = [
    { id: 'salary', name: '工资', icon: 'i-wallet' },
    { id: 'bonus', name: '奖金', icon: 'i-coin' },
    { id: 'redpacket', name: '红包', icon: 'i-redpacket' },
    { id: 'other', name: '其他', icon: 'i-dots' }
  ];

  /* 已下线的旧分类：历史流水按最接近的新分类展示 */
  var CAT_ALIAS = {
    home: 'daily', study: 'shop',
    invest: 'other', side: 'other', other_in: 'other'
  };

  /* 兜底项：只在历史数据里出现，不可在记账页选择 */
  var LEGACY_CAT = { id: 'legacy', name: '其他', icon: 'i-dots' };

  function cats(type) { return type === 'income' ? INCOME_CATS : EXPENSE_CATS; }

  function cat(type, id) {
    var list = cats(type);
    var wanted = CAT_ALIAS[id] || id;
    for (var i = 0; i < list.length; i++) if (list[i].id === wanted) return list[i];
    return LEGACY_CAT;
  }

  function catAny(id) {
    var all = EXPENSE_CATS.concat(INCOME_CATS);
    var wanted = CAT_ALIAS[id] || id;
    for (var i = 0; i < all.length; i++) if (all[i].id === wanted) return all[i];
    return LEGACY_CAT;
  }

  App.util = {
    pad2: pad2,
    dateStr: dateStr, todayStr: todayStr, currentYm: currentYm,
    ymOf: ymOf, isDate: isDate, isYm: isYm,
    ymLabel: ymLabel, ymShort: ymShort, shiftYm: shiftYm,
    daysInYm: daysInYm, dayNum: dayNum, weekdayCn: weekdayCn,
    mdLabel: mdLabel, relDay: relDay, nowIso: nowIso,
    money: money, moneyShort: moneyShort, yuanInput: yuanInput,
    parseAmount: parseAmount, cleanAmount: cleanAmount,
    clamp: clamp, sum: sum, uid: uid, esc: esc, ico: ico, bytes: bytes,
    EXPENSE_CATS: EXPENSE_CATS, INCOME_CATS: INCOME_CATS,
    cats: cats, cat: cat, catAny: catAny
  };
})(window.App);
