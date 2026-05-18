// src/utils/validateRut.js

/**
 * Remove dots, spaces and convert K to uppercase.
 */
export const sanitizeRut = (rut) => {
  if (!rut) return '';
  return rut.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
};

/**
 * Calculate Chilean RUT verification digit.
 * Returns true if the verifier matches.
 */
export const validateRut = (rut) => {
  const clean = sanitizeRut(rut);
  const match = clean.match(/^(\d{7,8})-?([0-9K])$/);
  if (!match) return false;
  const number = match[1];
  const dv = match[2];
  let sum = 0;
  let mul = 2;
  for (let i = number.length - 1; i >= 0; i--) {
    sum += parseInt(number[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const mod = 11 - (sum % 11);
  const calculatedDv = mod === 11 ? '0' : mod === 10 ? 'K' : String(mod);
  return dv === calculatedDv;
};

/**
 * Return formatted RUT with hyphen and uppercase K.
 */
export const formatRut = (rut) => {
  const clean = sanitizeRut(rut);
  if (!clean) return '';
  const parts = clean.split('-');
  if (parts.length === 2) return `${parts[0]}-${parts[1]}`;
  // If dash missing, insert before last char
  const number = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${number}-${dv}`;
};
