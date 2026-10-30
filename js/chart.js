/* =========================================================
   小账本 · 图表
   纯手绘 SVG：收支趋势面积曲线 / 分类支出环形图
   全部用 viewBox，隐藏 Tab 里宽度为 0 也不会算出 NaN
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;

  function r1(n) { return Math.round(n * 10) / 10; }

  function empty(text) {
    return '<div class="chart-empty">' + U.esc(text || '还没有数据') + '</div>';
  }

  function niceMax(v) {
    if (!isFinite(v) || v <= 0) return 100;
    var mag = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var n = v / mag;
    var f = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 4 ? 4
      : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return f * mag;
  }

  /* ---------- 收支趋势：收入 / 支出双面积曲线 ---------- */
  function trendAreaChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty('这段时间还没有收支记录');

    var max = 0;
    data.forEach(function (d) { max = Math.max(max, d.income || 0, d.expense || 0); });
    if (max <= 0) return empty('这段时间还没有收支记录');

    var n = data.length;
    var W = 340, H = 186, padL = 10, padR = 10, padT = 18, padB = 28;
    var base = H - padB;
    var innerH = base - padT;
    var top = niceMax(max);
    var topPad = 12;
    var stepX = n > 1 ? (W - padL - padR) / (n - 1) : 0;

    function xOf(i) { return n > 1 ? padL + stepX * i : W / 2; }
    function yOf(v) { return base - (v / top) * (innerH - topPad); }

    var gidIn = 'gin_' + Math.random().toString(36).slice(2, 7);
    var gidEx = 'gex_' + Math.random().toString(36).slice(2, 7);

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="收支趋势">';
    svg += '<defs>' +
      '<linearGradient id="' + gidIn + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#8FD0B8" stop-opacity=".45"/>' +
        '<stop offset="1" stop-color="#8FD0B8" stop-opacity=".02"/></linearGradient>' +
      '<linearGradient id="' + gidEx + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#F3B3A2" stop-opacity=".42"/>' +
        '<stop offset="1" stop-color="#F3B3A2" stop-opacity=".02"/></linearGradient>' +
      '</defs>';

    [0.5, 1].forEach(function (k) {
      var y = r1(base - (innerH - topPad) * k);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="#F0E6D3" stroke-width="1" stroke-dasharray="3 5"/>';
    });
    svg += '<line x1="' + padL + '" y1="' + base + '" x2="' + (W - padR) + '" y2="' + base +
      '" stroke="#E7DBC4" stroke-width="1.2"/>';

    function series(key, grad, lineColor) {
      if (n < 2) return '';
      var line = '', area = '';
      data.forEach(function (d, i) {
        var x = r1(xOf(i)), y = r1(yOf(d[key] || 0));
        line += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
        area += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      });
      area += 'L' + r1(xOf(n - 1)) + ' ' + base + ' L' + r1(xOf(0)) + ' ' + base + ' Z';
      return '<path d="' + area + '" fill="url(#' + grad + ')" stroke="none"/>' +
        '<path d="' + line + '" fill="none" stroke="' + lineColor + '" stroke-width="2.2" ' +
          'stroke-linecap="round" stroke-linejoin="round"/>';
    }

    // 支出在下、收入在上
    svg += series('expense', gidEx, '#DE7A6A');
    svg += series('income', gidIn, '#3E8E77');

    data.forEach(function (d, i) {
      var x = r1(xOf(i));
      svg += '<circle cx="' + x + '" cy="' + r1(yOf(d.income)) + '" r="2.6" fill="#FFFDF7" ' +
        'stroke="#3E8E77" stroke-width="1.7"><title>' +
        U.esc(U.ymLabel(d.ym) + ' 收入 ¥' + U.money(d.income)) + '</title></circle>';
      svg += '<circle cx="' + x + '" cy="' + r1(yOf(d.expense)) + '" r="2.6" fill="#FFFDF7" ' +
        'stroke="#DE7A6A" stroke-width="1.7"><title>' +
        U.esc(U.ymLabel(d.ym) + ' 支出 ¥' + U.money(d.expense)) + '</title></circle>';
    });

    var step = Math.ceil(n / 8);
    data.forEach(function (d, i) {
      if (i % step !== 0 && i !== n - 1) return;
      svg += '<text x="' + r1(xOf(i)) + '" y="' + (base + 18) + '" text-anchor="middle" ' +
        'font-size="9.5" fill="#9C9184">' + U.esc(d.label) + '</text>';
    });

    // 悬浮提示热区
    var hitW = n > 1 ? stepX : (W - padL - padR);
    data.forEach(function (d, i) {
      svg += '<rect x="' + r1(xOf(i) - hitW / 2) + '" y="' + padT + '" width="' + r1(hitW) +
        '" height="' + r1(innerH - topPad) + '" fill="transparent"><title>' +
        U.esc(U.ymLabel(d.ym) + ' 收入 ¥' + U.money(d.income) + ' · 支出 ¥' + U.money(d.expense)) +
        '</title></rect>';
    });

    svg += '</svg>';
    return svg;
  }

  /* ---------- 分类支出环形图 ---------- */
  function donut(items, opts) {
    opts = opts || {};
    var list = (items || []).filter(function (x) { return x.value > 0; });
    var total = 0;
    list.forEach(function (x) { total += x.value; });
    if (!total) return empty();

    var cx = 60, cy = 60, r = 52, w = 16;
    var gap = list.length > 1 ? 1.4 : 0;

    var svg = '<svg viewBox="0 0 120 120" role="img" aria-label="支出分类占比">';
    svg += '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#F4ECDC" stroke-width="' + w + '"/>';

    var start = -90;
    list.forEach(function (x) {
      var end = start + (x.value / total) * 360;
      var a0 = start + gap / 2;
      var a1 = end - gap / 2;
      if (a1 <= a0) a1 = a0;
      svg += '<path d="' + arc(cx, cy, r, a0, a1) + '" fill="none" stroke="' + x.color +
        '" stroke-width="' + w + '"><title>' +
        U.esc(x.label + ' ' + ((x.value / total) * 100).toFixed(1) + '% · ¥' + U.money(x.value)) +
        '</title></path>';
      start = end;
    });

    svg += '<text x="60" y="55" text-anchor="middle" font-size="9" fill="#9C9184">' +
      U.esc(opts.centerLabel || '合计') + '</text>';
    svg += '<text x="60" y="71" text-anchor="middle" font-size="15" font-weight="800" fill="#3A342B">' +
      U.esc(opts.centerValue || '') + '</text>';
    svg += '</svg>';
    return svg;
  }

  /* 圆环扇区的 path：从 a0 度画到 a1 度 */
  function arc(cx, cy, r, a0, a1) {
    function pt(a) {
      var rad = a * Math.PI / 180;
      return [r1(cx + r * Math.cos(rad)), r1(cy + r * Math.sin(rad))];
    }
    var p0 = pt(a0), p1 = pt(a1);
    var large = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + p0[0] + ' ' + p0[1] + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0] + ' ' + p1[1];
  }

  App.chart = {
    trendAreaChart: trendAreaChart,
    donut: donut,
    empty: empty
  };
})(window.App);
