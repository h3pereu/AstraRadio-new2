export type IcecastPayload = {
  icestats?: {
    source?: IcecastSource | IcecastSource[];
  };
};

export type IcecastSource = {
  listenurl?: string;
  title?: string;
  [key: string]: unknown;
};

export const STATUS_URL = 'https://astra.icecast.cz/status-json.xsl';

const CP1251_BASIC = [
  0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021,
  0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
  0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f,
  0x00a0, 0x040e, 0x045e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7,
  0x0401, 0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407,
  0x00b0, 0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7,
  0x0451, 0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
];

const CP1251_TABLE = CP1251_BASIC.concat(
  Array.from({ length: 32 }, (_, i) => 0x0410 + i),
  Array.from({ length: 32 }, (_, i) => 0x0430 + i),
);

const decodeCp1251 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i];
    if (value < 0x80) {
      result += String.fromCharCode(value);
    } else {
      result += String.fromCharCode(CP1251_TABLE[value - 0x80]);
    }
  }
  return result;
};

const decodeUtf8 = (buffer: ArrayBuffer) => {
  // Try TextDecoder first (most reliable)
  if (typeof TextDecoder !== 'undefined') {
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(buffer);
    } catch (e) {
      console.warn('[Icecast] TextDecoder failed:', e);
    }
  }

  // Fallback: manual UTF-8 decoding
  const bytes = new Uint8Array(buffer);
  let result = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];

    if (byte < 0x80) {
      // 1-byte character (ASCII)
      result += String.fromCharCode(byte);
    } else if ((byte & 0xE0) === 0xC0 && i + 1 < bytes.length) {
      // 2-byte character
      const byte2 = bytes[++i];
      const codePoint = ((byte & 0x1F) << 6) | (byte2 & 0x3F);
      result += String.fromCharCode(codePoint);
    } else if ((byte & 0xF0) === 0xE0 && i + 2 < bytes.length) {
      // 3-byte character
      const byte2 = bytes[++i];
      const byte3 = bytes[++i];
      const codePoint = ((byte & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F);
      result += String.fromCharCode(codePoint);
    } else if ((byte & 0xF8) === 0xF0 && i + 3 < bytes.length) {
      // 4-byte character (surrogate pair)
      const byte2 = bytes[++i];
      const byte3 = bytes[++i];
      const byte4 = bytes[++i];
      let codePoint = ((byte & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
      codePoint -= 0x10000;
      result += String.fromCharCode(0xD800 + (codePoint >> 10), 0xDC00 + (codePoint & 0x3FF));
    } else {
      // Invalid UTF-8, skip
      result += '\uFFFD';
    }
  }

  return result;
};

const safeParseJson = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

// Repair double-encoded UTF-8 text (UTF-8 bytes interpreted as Latin-1 or CP1252)
// Example: "Ð¢ÑÐ¸ Ð´Ð½Ñ Ð´Ð¾Ð¶Ð´Ñ" -> "Три дня дождя"
const repairDoubleEncodedUtf8 = (text: string): string => {
  // Check if text contains C2/C3 sequences which indicate double-encoding
  // Ð (D0), Ñ (D1), etc. are Cyrillic UTF-8 lead bytes double-encoded
  if (!text || !/[\xC0-\xFF]/.test(text)) {
    return text;
  }

  try {
    // Convert each character back to its byte value and re-decode as UTF-8
    const bytes = new Uint8Array(text.split('').map(c => c.charCodeAt(0)));

    // Only repair if the result looks like valid UTF-8
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      try {
        const repaired = decoder.decode(bytes);
        // Check if repair produced valid Cyrillic or other extended chars
        if (/[\u0400-\u04FF]/.test(repaired) || /[\u3000-\u9FFF]/.test(repaired)) {
          return repaired;
        }
      } catch {
        // Decoding failed, text was not double-encoded
      }
    }
  } catch {
    // Any error, return original
  }

  return text;
};

// Repair all title fields in the payload
const repairPayloadTitles = (payload: IcecastPayload | null): IcecastPayload | null => {
  if (!payload?.icestats?.source) return payload;

  const sources = Array.isArray(payload.icestats.source)
    ? payload.icestats.source
    : [payload.icestats.source];

  for (const source of sources) {
    if (source?.title) {
      source.title = repairDoubleEncodedUtf8(source.title);
    }
  }

  return payload;
};

export const normalizeSources = (rawSources?: IcecastSource | IcecastSource[]) => {
  if (Array.isArray(rawSources)) {
    return rawSources;
  }
  if (rawSources && typeof rawSources === 'object') {
    return [rawSources];
  }
  return [];
};

export const fetchIcecastStatus = async (url = STATUS_URL) => {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const buffer = await response.arrayBuffer();
  const utf8Text = decodeUtf8(buffer);
  const utf8Payload = safeParseJson<IcecastPayload>(utf8Text);
  if (utf8Payload && !utf8Text.includes('\uFFFD')) {
    // Repair any double-encoded titles before returning
    return repairPayloadTitles(utf8Payload);
  }

  const cp1251Text = decodeCp1251(buffer);
  const cp1251Payload = safeParseJson<IcecastPayload>(cp1251Text);
  return repairPayloadTitles(cp1251Payload ?? utf8Payload);
};
