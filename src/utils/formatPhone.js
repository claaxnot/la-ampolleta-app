// src/utils/formatPhone.js
// Utilidades de formateo y validación de números telefónicos chilenos (+56 9 XXXX XXXX)

/**
 * Limpia cualquier carácter que no sea numérico.
 */
export const sanitizePhone = (phone) => {
  if (!phone) return "";
  return phone.toString().replace(/[^0-9]/g, "");
};

/**
 * Formatea dinámicamente un número al formato oficial móvil chileno:
 * Ej: "912345678" -> "+56 9 1234 5678"
 */
export const formatChileanPhone = (value) => {
  if (!value) return "";

  let digits = sanitizePhone(value);

  // Si empieza con 56 (código de país Chile), removerlo para procesar el número local
  if (digits.startsWith("56")) {
    digits = digits.slice(2);
  }

  // Si el usuario no ingresó el 9 inicial pero ya tiene dígitos, o si comienza con 9
  // Los celulares en Chile siempre tienen 9 dígitos y parten con 9.
  if (digits.length > 0 && !digits.startsWith("9") && digits.length <= 8) {
    // Si escribió directo sin el 9 (ej: 87654321), se lo anteponemos automáticamente
    digits = "9" + digits;
  }

  // Limitar a máximo 9 dígitos locales
  const clean = digits.slice(0, 9);

  if (clean.length === 0) return "";
  if (clean.length === 1) return `+56 ${clean}`;
  if (clean.length <= 5) return `+56 ${clean.slice(0, 1)} ${clean.slice(1)}`;
  return `+56 ${clean.slice(0, 1)} ${clean.slice(1, 5)} ${clean.slice(5, 9)}`;
};

/**
 * Valida si el número cumple con el estándar de telefonía móvil en Chile:
 * 9 dígitos locales y comenzando con 9 (+56 9 XXXX XXXX).
 */
export const validateChileanPhone = (phone) => {
  if (!phone) return false;
  let digits = sanitizePhone(phone);
  if (digits.startsWith("56")) {
    digits = digits.slice(2);
  }
  return digits.length === 9 && digits.startsWith("9");
};

/**
 * Retorna el número estándar para enlaces directos de WhatsApp (ej: "56912345678")
 */
export const getCleanWhatsAppPhone = (phone) => {
  if (!phone) return "";
  let digits = sanitizePhone(phone);
  if (digits.startsWith("56")) {
    return digits;
  }
  if (digits.length === 9 && digits.startsWith("9")) {
    return `56${digits}`;
  }
  if (digits.length === 8) {
    return `569${digits}`;
  }
  return digits;
};
