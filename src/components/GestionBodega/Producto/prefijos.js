// prefijos.js
// Opciones de producto (logística + metales RS) y mapa tipo→prefijo para autogenerar Id_producto

export const OPCIONES_TIPO_PRODUCTO = [
  // --------- Logística (no metales) ----------
  { value: 'YUTES', label: '(YUT) Yutes' },
  { value: 'ROLLOS', label: '(ROL) Rollos' },
  { value: 'PALLETS', label: '(PAL) Pallets' },
  { value: 'CAJAS', label: '(CAJ) Cajas' },
  { value: 'UNITARIO', label: '(UNI) Unitario' },
  { value: 'EXTRADIMENSIONADO', label: '(EXT) Extradimensionado' },
  { value: 'BULTOS', label: '(BUL) Bultos' },
  { value: 'GUACALES', label: '(GUA) Guacales' },

  // ========= Metales =========
  // --------- Cobalto (RS) ----------
  { value: 'COBALTO HS-6 (RS LIMPIO)', label: '(RS) Cobalto HS-6 — Limpio' },
  { value: 'COBALTO HS-6 (RS SUCIO)', label: '(RS) Cobalto HS-6 — Sucio' },
  { value: 'COBALTO HS-12 (RS LIMPIO)', label: '(RS) Cobalto HS-12 — Limpio' },
  { value: 'COBALTO HS-12 (RS SUCIO)', label: '(RS) Cobalto HS-12 — Sucio' },

  // --------- Tungsteno (RS) ----------
  {
    value: 'TUNGSTENO W-BUJES (RS LIMPIO)',
    label: '(RS) Tungsteno W-Bujes — Limpio',
  },
  {
    value: 'TUNGSTENO W-BUJES (RS SUCIO)',
    label: '(RS) Tungsteno W-Bujes — Sucio',
  },
  {
    value: 'TUNGSTENO W-INSERTOS (RS LIMPIO)',
    label: '(RS) Tungsteno W-Insertos — Limpio',
  },
  {
    value: 'TUNGSTENO W-INSERTOS (RS SUCIO)',
    label: '(RS) Tungsteno W-Insertos — Sucio',
  },
  {
    value: 'TUNGSTENO W-MORGAN (RS LIMPIO)',
    label: '(RS) Tungsteno W-Morgan — Limpio',
  },
  {
    value: 'TUNGSTENO W-MORGAN (RS SUCIO)',
    label: '(RS) Tungsteno W-Morgan — Sucio',
  },

  // --------- Níquel (RS) ----------
  {
    value: 'INCONEL 718 (RS LIMPIO)',
    label: '(RS) Nickel Inconel 718 — Limpio',
  },
  { value: 'INCONEL 718 (RS SUCIO)', label: '(RS) Nickel Inconel 718 — Sucio' },
  {
    value: 'INCONEL 625 (RS LIMPIO)',
    label: '(RS) Nickel Inconel 625 — Limpio',
  },
  { value: 'INCONEL 625 (RS SUCIO)', label: '(RS) Nickel Inconel 625 — Sucio' },
  { value: 'ALLOY 400 (RS LIMPIO)', label: '(RS) Nickel Alloy 400 — Limpio' },
  { value: 'ALLOY 400 (RS SUCIO)', label: '(RS) Nickel Alloy 400 — Sucio' },
  {
    value: 'NI-RESIST 1 (RS LIMPIO)',
    label: '(RS) Nickel Ni-Resist 1 — Limpio',
  },
  { value: 'NI-RESIST 1 (RS SUCIO)', label: '(RS) Nickel Ni-Resist 1 — Sucio' },

  // --------- Aceros Inoxidables (RS) ----------
  { value: 'SS-316 (RS LIMPIO)', label: '(RS) Acero Inoxidable 316 — Limpio' },
  { value: 'SS-316 (RS SUCIO)', label: '(RS) Acero Inoxidable 316 — Sucio' },
  { value: 'SS-304 (RS LIMPIO)', label: '(RS) Acero Inoxidable 304 — Limpio' },
  { value: 'SS-304 (RS SUCIO)', label: '(RS) Acero Inoxidable 304 — Sucio' },
  { value: 'SS-321 (RS LIMPIO)', label: '(RS) Acero Inoxidable 321 — Limpio' },
  { value: 'SS-321 (RS SUCIO)', label: '(RS) Acero Inoxidable 321 — Sucio' },
  { value: 'SS-309 (RS LIMPIO)', label: '(RS) Acero Inoxidable 309 — Limpio' },
  { value: 'SS-309 (RS SUCIO)', label: '(RS) Acero Inoxidable 309 — Sucio' },
  { value: 'SS-310 (RS LIMPIO)', label: '(RS) Acero Inoxidable 310 — Limpio' },
  { value: 'SS-310 (RS SUCIO)', label: '(RS) Acero Inoxidable 310 — Sucio' },
  { value: 'SS-330 (RS LIMPIO)', label: '(RS) Acero Inoxidable 330 — Limpio' },
  { value: 'SS-330 (RS SUCIO)', label: '(RS) Acero Inoxidable 330 — Sucio' },

  // ========= Materiales RS Genéricos =========
  {
    value: 'COBRE ALAMBRON (RS LIMPIO)',
    label: '(RS) Cobre Alambrón — Limpio',
  },
  { value: 'COBRE ALAMBRON (RS SUCIO)', label: '(RS) Cobre Alambrón — Sucio' },

  { value: 'ROTORES (RS LIMPIO)', label: '(RS) Rotores — Limpio' },
  { value: 'ROTORES (RS SUCIO)', label: '(RS) Rotores — Sucio' },

  {
    value: 'CHICOTES TUBERIA QUEMAR (RS LIMPIO)',
    label: '(RS) Chicotes de tubería para quemar — Limpio',
  },
  {
    value: 'CHICOTES TUBERIA QUEMAR (RS SUCIO)',
    label: '(RS) Chicotes de tubería para quemar — Sucio',
  },

  {
    value: 'CABLE QUEMAR (RS LIMPIO)',
    label: '(RS) Cable para quemar — Limpio',
  },
  { value: 'CABLE QUEMAR (RS SUCIO)', label: '(RS) Cable para quemar — Sucio' },

  { value: 'ACERO 304 (RS LIMPIO)', label: '(RS) Acero 304 — Limpio' },
  { value: 'ACERO 304 (RS SUCIO)', label: '(RS) Acero 304 — Sucio' },

  { value: 'COBALTO (RS LIMPIO)', label: '(RS) Cobalto — Limpio' },
  { value: 'COBALTO (RS SUCIO)', label: '(RS) Cobalto — Sucio' },

  { value: 'TORNILLOS 304 (RS LIMPIO)', label: '(RS) Tornillos 304 — Limpio' },
  { value: 'TORNILLOS 304 (RS SUCIO)', label: '(RS) Tornillos 304 — Sucio' },

  { value: 'TUNGSTENO (RS LIMPIO)', label: '(RS) Tungsteno — Limpio' },
  { value: 'TUNGSTENO (RS SUCIO)', label: '(RS) Tungsteno — Sucio' },

  { value: 'MONEL (RS LIMPIO)', label: '(RS) Monel — Limpio' },
  { value: 'MONEL (RS SUCIO)', label: '(RS) Monel — Sucio' },

  { value: 'BRONCE (RS LIMPIO)', label: '(RS) Bronce — Limpio' },
  { value: 'BRONCE (RS SUCIO)', label: '(RS) Bronce — Sucio' },
]

// Mapa tipo → prefijo (sin colisiones). Los metales usan RS-<CÓDIGO>-L/S.
export const PREFIJO_POR_TIPO = {
  // Logística
  YUTES: 'YUT',
  ROLLOS: 'ROL',
  PALLETS: 'PAL',
  CAJAS: 'CAJ',
  UNITARIO: 'UNI',
  EXTRADIMENSIONADO: 'EXT',
  BULTOS: 'BUL',
  GUACALES: 'GUA',

  // Cobalto
  'COBALTO HS-6 (RS LIMPIO)': 'RS-CHS6-L',
  'COBALTO HS-6 (RS SUCIO)': 'RS-CHS6-S',
  'COBALTO HS-12 (RS LIMPIO)': 'RS-CHS12-L',
  'COBALTO HS-12 (RS SUCIO)': 'RS-CHS12-S',

  // Tungsteno
  'TUNGSTENO W-BUJES (RS LIMPIO)': 'RS-WBUJ-L',
  'TUNGSTENO W-BUJES (RS SUCIO)': 'RS-WBUJ-S',
  'TUNGSTENO W-INSERTOS (RS LIMPIO)': 'RS-WINS-L',
  'TUNGSTENO W-INSERTOS (RS SUCIO)': 'RS-WINS-S',
  'TUNGSTENO W-MORGAN (RS LIMPIO)': 'RS-WMOR-L',
  'TUNGSTENO W-MORGAN (RS SUCIO)': 'RS-WMOR-S',

  // Níquel
  'INCONEL 718 (RS LIMPIO)': 'RS-NI718-L',
  'INCONEL 718 (RS SUCIO)': 'RS-NI718-S',
  'INCONEL 625 (RS LIMPIO)': 'RS-NI625-L',
  'INCONEL 625 (RS SUCIO)': 'RS-NI625-S',
  'ALLOY 400 (RS LIMPIO)': 'RS-AL400-L',
  'ALLOY 400 (RS SUCIO)': 'RS-AL400-S',
  'NI-RESIST 1 (RS LIMPIO)': 'RS-NIR1-L',
  'NI-RESIST 1 (RS SUCIO)': 'RS-NIR1-S',

  // Aceros Inox
  'SS-316 (RS LIMPIO)': 'RS-SS316-L',
  'SS-316 (RS SUCIO)': 'RS-SS316-S',
  'SS-304 (RS LIMPIO)': 'RS-SS304-L',
  'SS-304 (RS SUCIO)': 'RS-SS304-S',
  'SS-321 (RS LIMPIO)': 'RS-SS321-L',
  'SS-321 (RS SUCIO)': 'RS-SS321-S',
  'SS-309 (RS LIMPIO)': 'RS-SS309-L',
  'SS-309 (RS SUCIO)': 'RS-SS309-S',
  'SS-310 (RS LIMPIO)': 'RS-SS310-L',
  'SS-310 (RS SUCIO)': 'RS-SS310-S',
  'SS-330 (RS LIMPIO)': 'RS-SS330-L',
  'SS-330 (RS SUCIO)': 'RS-SS330-S',

  // RS Genéricos
  'COBRE ALAMBRON (RS LIMPIO)': 'RS-CGEN-L',
  'COBRE ALAMBRON (RS SUCIO)': 'RS-CGEN-S',

  'ROTORES (RS LIMPIO)': 'RS-RGEN-L',
  'ROTORES (RS SUCIO)': 'RS-RGEN-S',

  'CHICOTES TUBERIA QUEMAR (RS LIMPIO)': 'RS-CHI-L',
  'CHICOTES TUBERIA QUEMAR (RS SUCIO)': 'RS-CHI-S',

  'CABLE QUEMAR (RS LIMPIO)': 'RS-CAB-L',
  'CABLE QUEMAR (RS SUCIO)': 'RS-CAB-S',

  'ACERO 304 (RS LIMPIO)': 'RS-SS304-L',
  'ACERO 304 (RS SUCIO)': 'RS-SS304-S',

  'COBALTO (RS LIMPIO)': 'RS-CGEN-L',
  'COBALTO (RS SUCIO)': 'RS-CGEN-S',

  'TORNILLOS 304 (RS LIMPIO)': 'RS-SS304-L',
  'TORNILLOS 304 (RS SUCIO)': 'RS-SS304-S',

  'TUNGSTENO (RS LIMPIO)': 'RS-WGEN-L',
  'TUNGSTENO (RS SUCIO)': 'RS-WGEN-S',

  'MONEL (RS LIMPIO)': 'RS-MGEN-L',
  'MONEL (RS SUCIO)': 'RS-MGEN-S',

  'BRONCE (RS LIMPIO)': 'RS-BGEN-L',
  'BRONCE (RS SUCIO)': 'RS-BGEN-S',
}

export default OPCIONES_TIPO_PRODUCTO
