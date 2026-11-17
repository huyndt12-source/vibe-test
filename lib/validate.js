'use strict';

// Quy tắc theo docs/04-quy-tac-du-lieu.html mục 9.2.
// Dùng ở server (nơi quyết định) và được app/signup.js nhắc lại ở client.

// Chữ cái có dấu tiếng Việt, khoảng trắng, nháy đơn, gạch nối, dấu phẩy, dấu chấm.
// Không chữ số, không < > & " / (docs/04 mục 9.2).
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '\-.,]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function validateFullName(raw) {
  const value = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (value.length < 2 || value.length > 80 || !NAME_RE.test(value)) {
    return { error: 'Họ tên phải từ 2 đến 80 ký tự, không chứa chữ số.' };
  }
  return { value };
}

function validateEmail(raw) {
  const value = String(raw == null ? '' : raw).trim().toLowerCase();
  if (value.length > 120 || !EMAIL_RE.test(value)) {
    return { error: 'Email không đúng định dạng, ví dụ: ten@vidu.com' };
  }
  return { value };
}

// Chuẩn hóa về dạng chỉ còn chữ số, đầu số 0: "+84 901 234 567" -> "0901234567".
function validatePhone(raw) {
  const cleaned = String(raw == null ? '' : raw).replace(/[\s.\-()]/g, '');
  const error = { error: 'Số điện thoại phải có 9–11 chữ số, ví dụ: 0901234567' };
  let digits;
  if (/^\+84\d{9,10}$/.test(cleaned)) {
    digits = `0${cleaned.slice(3)}`;
  } else if (/^0\d{8,10}$/.test(cleaned)) {
    digits = cleaned;
  } else if (/^\d{9,11}$/.test(cleaned)) {
    digits = cleaned.startsWith('0') ? cleaned : `0${cleaned}`;
  } else {
    return error;
  }
  if (digits.length < 10 || digits.length > 11) return error;
  return { value: digits };
}

// Trả về { ok: true, data } hoặc { ok: false, errors: { field: message } }.
function validateRegistration(body) {
  const checks = {
    fullName: validateFullName(body && body.fullName),
    email: validateEmail(body && body.email),
    phone: validatePhone(body && body.phone),
  };
  const errors = {};
  const data = {};
  for (const [field, result] of Object.entries(checks)) {
    if (result.error) errors[field] = result.error;
    else data[field] = result.value;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

const MAX_SCORE = 200;

function validateScore(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > MAX_SCORE) {
    return { ok: false, error: `Điểm phải là số nguyên trong khoảng 0–${MAX_SCORE}.` };
  }
  return { ok: true, value };
}

module.exports = { validateRegistration, validateScore, validateFullName, validateEmail, validatePhone, MAX_SCORE };
