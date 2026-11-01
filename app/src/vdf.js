// Minimal parser for Valve's text KeyValues format (.vdf / .acf).
// Keys are lower-cased so lookups don't depend on Valve's inconsistent casing.
'use strict';

function parse(text) {
  let i = 0;
  const n = text.length;

  function skip() {
    while (i < n) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '﻿') { i++; continue; }
      if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
      break;
    }
  }

  function token() {
    skip();
    if (i >= n) return null;
    const c = text[i];
    if (c === '{' || c === '}') { i++; return { t: c }; }
    if (c === '"') {
      i++;
      let s = '';
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) {
          const e = text[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          i += 2;
        } else s += text[i++];
      }
      i++;
      return { t: 's', v: s };
    }
    let s = '';
    while (i < n && !/[\s{}"]/.test(text[i])) s += text[i++];
    return { t: 's', v: s };
  }

  function obj() {
    const o = {};
    for (;;) {
      const k = token();
      if (!k || k.t === '}') return o;
      if (k.t !== 's') continue;
      const v = token();
      if (!v) return o;
      const key = k.v.toLowerCase();
      if (v.t === '{') o[key] = obj();
      else if (v.t === 's') o[key] = v.v;
    }
  }

  return obj();
}

module.exports = { parse };
