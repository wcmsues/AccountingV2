/* =========================================================
   小账本 · 图表
   纯手绘 SVG：分组柱状图 / 面积折线 / 目标进度环
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

  /* ---------- 近 6 个月收支分组柱状图 ---------- */
  function barChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty();

    var max = 0;
    data.forEach(function (d) { max = Math.max(max, d.income || 0, d.expense || 0); });
    if (max <= 0) return empty('这几个月还没有收支记录');

    var W = 340, H = 176, padL = 6, padR = 6, padT = 18, padB = 30;
    var base = H - padB;
    var innerH = base - padT;
    var top = niceMax(max);
    var bw = (W - padL - padR) / data.length;
    var barW = Math.max(6, Math.min(13, (bw - 12) / 2));
    var gap = 5;

    function yOf(v) { return base - (v / top) * innerH; }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近 6 个月收支">';

    // 网格
    [0.5, 1].forEach(function (k) {
      var y = r1(base - innerH * k);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="#F0E6D3" stroke-width="1" stroke-dasharray="3 5"/>';
    });
    svg += '<line x1="' + padL + '" y1="' + base + '" x2="' + (W - padR) + '" y2="' + base +
      '" stroke="#E7DBC4" stroke-width="1.2"/>';

    data.forEach(function (d, i) {
      var gx = padL + i * bw;
      var cx = gx + bw / 2;
      var active = opts.activeYm && d.ym === opts.activeYm;

      if (active) {
        svg += '<rect x="' + r1(gx + 1) + '" y="' + (padT - 8) + '" width="' + r1(bw - 2) +
          '" height="' + r1(innerH + 10) + '" rx="10" fill="#FFF9EA" stroke="#F3E6CC" stroke-width="1"/>';
      }

      var hIn = d.income > 0 ? Math.max(3, (d.income / top) * innerH) : 0;
      var hEx = d.expense > 0 ? Math.max(3, (d.expense / top) * innerH) : 0;
      var xIn = cx - barW - gap / 2;
      var xEx = cx + gap / 2;

      if (hIn > 0) {
        svg += '<rect x="' + r1(xIn) + '" y="' + r1(base - hIn) + '" width="' + r1(barW) +
          '" height="' + r1(hIn) + '" rx="' + r1(barW / 2) + '" fill="' +
          (active ? '#3E8E77' : '#8FD0B8') + '"><title>' + U.esc(d.label + ' 收入 ¥' + U.money(d.income)) + '</title></rect>';
      }
      if (hEx > 0) {
        svg += '<rect x="' + r1(xEx) + '" y="' + r1(base - hEx) + '" width="' + r1(barW) +
          '" height="' + r1(hEx) + '" rx="' + r1(barW / 2) + '" fill="' +
          (active ? '#DE7A6A' : '#F3B3A2') + '"><title>' + U.esc(d.label + ' 支出 ¥' + U.money(d.expense)) + '</title></rect>';
      }

      svg += '<text x="' + r1(cx) + '" y="' + (base + 18) + '" text-anchor="middle" font-size="9.5" font-weight="' +
        (active ? '700' : '500') + '" fill="' + (active ? '#2F6E5C' : '#9C9184') + '">' +
        U.esc(d.label) + '</text>';

      svg += '<rect class="bar-hit" x="' + r1(gx) + '" y="' + padT + '" width="' + r1(bw) +
        '" height="' + innerH + '" fill="transparent" data-ym="' + U.esc(d.ym) + '"></rect>';
    });

    svg += '</svg>';
    return svg;
  }

  /* ---------- 存款面积折线 ---------- */
  function areaChart(points, opts) {
    opts = opts || {};
    if (!points || points.length < 2) return empty('存上几笔，就能看到曲线了');

    var W = 340, H = 172, padL = 10, padR = 10, padT = 20, padB = 28;
    var base = H - padB;
    var innerH = base - padT;

    var lo = Number.MAX_VALUE, hi = -Number.MAX_VALUE;
    points.forEach(function (p) {
      lo = Math.min(lo, p.value);
      hi = Math.max(hi, p.value);
    });
    var target = opts.target != null ? Number(opts.target) : null;
    if (target != null && target > 0) hi = Math.max(hi, target);

    if (lo === hi) { hi = lo + 100; }
    var span = hi - lo;
    lo = Math.max(0, lo - span * 0.18);
    hi = hi + span * 0.14;

    var n = points.length;
    var stepX = (W - padL - padR) / (n - 1);

    function xOf(i) { return padL + stepX * i; }
    function yOf(v) { return base - ((v - lo) / (hi - lo)) * innerH; }

    var line = '';
    var area = '';
    points.forEach(function (p, i) {
      var x = r1(xOf(i)), y = r1(yOf(p.value));
      line += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      area += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
    });
    area += 'L' + r1(xOf(n - 1)) + ' ' + base + ' L' + r1(xOf(0)) + ' ' + base + ' Z';

    var gid = 'grad_' + Math.random().toString(36).slice(2, 7);

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="存款变化">';
    svg += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#8FD0B8" stop-opacity=".42"/>' +
      '<stop offset="1" stop-color="#8FD0B8" stop-opacity=".02"/></linearGradient></defs>';

    svg += '<line x1="' + padL + '" y1="' + base + '" x2="' + (W - padR) + '" y2="' + base +
      '" stroke="#E7DBC4" stroke-width="1.2"/>';

    if (target != null && target > 0) {
      var ty = r1(yOf(target));
      svg += '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty +
        '" stroke="#C9A88F" stroke-width="1.2" stroke-dasharray="4 5"/>';
      svg += '<text x="' + (W - padR) + '" y="' + (ty - 5) + '" text-anchor="end" font-size="9" fill="#A9812F">目标 ' +
        U.esc(U.moneyShort(target)) + '</text>';
    }

    svg += '<path d="' + area + '" fill="url(#' + gid + ')" stroke="none"/>';
    svg += '<path d="' + line + '" fill="none" stroke="#3E8E77" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';

    points.forEach(function (p, i) {
      var last = i === n - 1;
      svg += '<circle cx="' + r1(xOf(i)) + '" cy="' + r1(yOf(p.value)) + '" r="' + (last ? 4 : 2.4) +
        '" fill="' + (last ? '#3E8E77' : '#FFFDF7') + '" stroke="#3E8E77" stroke-width="1.6"/>';
      svg += '<text x="' + r1(xOf(i)) + '" y="' + (base + 18) + '" text-anchor="middle" font-size="9.5" fill="#9C9184">' +
        U.esc(p.label) + '</text>';
      svg += '<rect x="' + r1(xOf(i) - stepX / 2) + '" y="' + padT + '" width="' + r1(stepX) +
        '" height="' + innerH + '" fill="transparent"><title>' + U.esc(p.label + ' ¥' + U.money(p.value)) + '</title></rect>';
    });

    svg += '</svg>';
    return svg;
  }

  /* ---------- 进度环 ---------- */
  function ring(pct) {
    var p = U.clamp(Number(pct) || 0, 0, 100);
    return '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="#EDE2CD" stroke-width="10"/>' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="#3E8E77" stroke-width="10" stroke-linecap="round" ' +
      'pathLength="100" stroke-dasharray="100" stroke-dashoffset="' + r1(100 - p) + '" ' +
      'transform="rotate(-90 60 60)"/>' +
      '</svg>';
  }

  App.chart = {
    barChart: barChart,
    areaChart: areaChart,
    ring: ring,
    empty: empty
  };
})(window.App);
