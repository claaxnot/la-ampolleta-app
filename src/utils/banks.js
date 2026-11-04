// src/utils/banks.js
// Listado oficial de bancos chilenos y tipos de cuenta

export const BANCOS_CHILE = {
  "1": "Banco de Chile / Edwards",
  "9": "Banco Internacional",
  "12": "Banco Estado",
  "14": "Scotiabank Chile",
  "16": "Banco BCI/Mach",
  "28": "Banco Bice",
  "31": "HSBC Bank (Chile)",
  "37": "Banco Santander",
  "39": "Banco Itaú",
  "49": "Banco Security",
  "51": "Banco Falabella",
  "53": "Banco Ripley",
  "55": "Banco Consorcio",
  "59": "Banco BTG Pactual Chile",
  "672": "Coopeuch",
  "729": "Prepago Los Héroes",
  "730": "Tenpo",
  "732": "Prepago Los Andes (Tapp)",
  "738": "Global 66",
  "875": "Mercado Pago"
};

export const TIPOS_CUENTA = [
  "Cuenta Corriente",
  "Cuenta Vista / CuentaRUT",
  "Cuenta de Ahorro",
  "Prepago"
];

export const getBankName = (code) => {
  if (!code) return "-";
  return BANCOS_CHILE[String(code)] || `Banco (${code})`;
};
