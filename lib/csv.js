'use strict';

// docs/04-quy-tac-du-lieu.html mục 9.5.
const BOM = '﻿';
const HEADERS = [
  'Họ tên',
  'Email',
  'Số điện thoại',
  'Điểm cao nhất',
  'Số lượt',
  'Thời điểm đăng ký',
  'Lần chơi gần nhất',
];

function quote(value) {
  return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

// Giờ Việt Nam, dạng DD/MM/YYYY HH:mm.
function formatVn(date) {
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(date));
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

function fileName(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD
  return `dang-ky-dap-chuot-${parts}.csv`;
}

function build(rows) {
  const lines = [HEADERS.map(quote).join(',')];
  for (const row of rows) {
    lines.push([
      quote(row.full_name),
      quote(row.email),
      // Dấu nháy đơn đứng trước để Excel không cắt số 0 đầu.
      quote(`'${row.phone}`),
      quote(row.best_score),
      quote(row.plays),
      quote(formatVn(row.created_at)),
      quote(formatVn(row.last_played_at)),
    ].join(','));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

module.exports = { build, fileName, formatVn };
