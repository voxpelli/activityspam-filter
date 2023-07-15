// Tokenizer for activity spam filter
//
// Copyright 2011, 2012 StatusNet Inc.
// Copyright 2023 Pelle Wessman
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// eslint-disable-next-line unicorn/better-regex, no-useless-escape
const BOUNDARY = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|\-_\+@#]+/;

/**
 * @typedef TokenizerOptions
 * @property {boolean|undefined} [useBare]
 * @property {boolean|undefined} [useDigrams]
 * @property {boolean|undefined} [usePrefixes]
 * @property {boolean|undefined} [useArrayLength]
 */

export class Tokenizer {
  #useBare = true;
  #useDigrams = true;
  #usePrefixes = true;
  #useArrayLength = true;

  /**
   * @param {TokenizerOptions} [options]
   */
  constructor (options = {}) {
    this.#useBare = options.useBare ?? true;
    this.#useDigrams = options.useDigrams ?? true;
    this.#usePrefixes = options.usePrefixes ?? true;
    this.#useArrayLength = options.useArrayLength ?? true;
  }

  /**
   * @param {string} str
   * @returns {string[]}
   */
  #tokenArray (str) {
    return str.split(BOUNDARY).filter(s => s.length > 0);
  }

  /**
   * @param {string[]} parts
   * @returns {string[]}
   */
  #makeDigrams (parts) {
    /** @type {string[]} */
    const dg = [];

    for (let i = 0; i < parts.length; i++) {
      if (i === 0) {
        dg.push('^' + parts[i]);
      }
      if (i === parts.length - 1) {
        dg.push(parts[i] + '^');
      } else {
        dg.push(parts[i] + '^' + parts[i + 1]);
      }
    }

    return dg;
  }

  /**
   * @param {unknown} obj
   * @param {string} [previous]
   * @returns {string[]}
   */
  tokenize (obj, previous) {
    /** @type {string[]} */
    const tokens = [];

    if (this.#useArrayLength && obj && Array.isArray(obj)) {
      const full = previous !== undefined ? previous + '.length' : 'length';
      tokens.push(full + '=' + obj.length);
    }

    if (typeof obj !== 'object' || obj === null) {
      return tokens;
    }

    for (const prop in obj) {
      /** @type {unknown} */
      const val = obj[/** @type {keyof obj} */ (prop)];
      /** @type {string[]} */
      const fp = [];

      if (Array.isArray(obj)) {
        fp.push(previous !== undefined ? previous + '.N' : 'N');
      } else {
        fp.push(previous !== undefined ? previous + '.' + prop : prop);
      }

      for (const i in fp) {
        const full = fp[i];

        // Should never be true, but needed for types
        if (full === undefined) continue;

        if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') {
          const parts = this.#tokenArray(val.toString());

          if (this.#useBare) {
            tokens.push(...parts);
          }

          /** @type {string[]|undefined} */
          let digrams;

          if (this.#useDigrams) {
            digrams = this.#makeDigrams(parts);
            tokens.push(...digrams);
          }
          if (this.#usePrefixes) {
            const prefixed = parts.map(part => full + '=' + part);
            tokens.push(...prefixed);
            if (this.#useDigrams && digrams) {
              const prefixedDigrams = digrams.map(part => full + '=' + part);
              tokens.push(...prefixedDigrams);
            }
          }
        } else if (val && typeof val === 'object') {
          tokens.push(...this.tokenize(val, full));
        } else {
          // eslint-disable-next-line no-console
          console.warn('Unexpected data type in the tokenizer');
        }
      }
    }

    return tokens;
  }
}
