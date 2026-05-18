// src/utils/validateRut.js

/**
 * Remove everything except numbers and k/K, and convert K to uppercase.
 */
export const sanitizeRut = (rut) => {
  if (!rut) return '';
  return rut.toString().replace(/[^0-9kK]/g, '').toUpperCase();
};

/**
 * Return formatted RUT with hyphen (body-dv) dynamically.
 * e.g. "12345678K" -> "12345678-K"
 */
export const formatRut = (rut) => {
  const clean = sanitizeRut(rut);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body}-${dv}`;
};

/**
 * Calculate Chilean RUT verification digit.
 * Returns true if the verifier matches.
 */
export const validateRut = (rut) => {
  const clean = sanitizeRut(rut);
  // Chilean RUTs have 7 or 8 digits plus the verification digit (total 8 or 9 chars)
  if (clean.length < 8 || clean.length > 9) return false;
  
  const number = clean.slice(0, -1);
  const dv = clean.slice(-1);
  
  let sum = 0;
  let mul = 2;
  for (let i = number.length - 1; i >= 0; i--) {
    sum += parseInt(number[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const mod = 11 - (sum % 11);
  const calculatedDv = mod === 11 ? '0' : mod === 10 ? 'K' : String(mod);
  return dv === calculatedDv;
};
