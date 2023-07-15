// Filter function for
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

import crypto from 'node:crypto';

import Step from 'step';
import dateFormat from 'dateformat';
import { Tokenizer } from './tokenizer.js';
import {
  NoSuchThingError,
  SimpleDatabankRedis,
} from './simple-databank.js';

const RELEVANCE_CUTOFF = 20;
// const MINIMUM_OCCURENCES = 3;
const MINPROB = 0.0001;
const MAXPROB = 0.9999;
const DEFAULT_PROB = 0.4; // default probability for unseen values
const SPAM_PROB = 0.90; // cutoff for saying is or isn't
const UP = +1;
const DOWN = -1;
// const DIGRAMS = true;
// const PREFIXES = true;

/** @typedef {'spam'|'ham'} SpamFilterCategory */

/**
 * @template {string} [T=string]
 * @typedef SpamFilterDecision
 * @property {number} probability
 * @property {boolean} isSpam
 * @property {SpamFilterProbability<T>[]} bestKeys
 * @property {number} elapsed
 */

/**
 * @template {string} [T=string]
 * @typedef {[T, number]} SpamFilterProbability
 */

export class SpamFilter {

  /** @type {import('./simple-databank.js').SimpleDatabank} */
  #db;

  /**
   *
   * @param {import('ioredis').RedisOptions} dbConfig
   */
  constructor (dbConfig) {
    this.#db = new SimpleDatabankRedis(dbConfig);
  }

  /**
   * @param {SpamFilterCategory} cat
   * @returns {SpamFilterCategory}
   */
  opposite (cat) {
    if (cat === 'ham') {
      return 'spam';
    } else if (cat === 'spam') {
      return 'ham';
    } else {
      throw new Error('Unknown category: ' + cat);
    }
  }

  /**
   * @param {SpamFilterCategory} cat
   * @param {string[]} tokens
   * @param {UP|DOWN} dir
   * @returns {Promise<Array<number | undefined>>}
   */
  async #updateTokenCounts (cat, tokens, dir) {
    const opp = this.opposite(cat);
    const catTotalKey = cat + 'total';
    const oppTotalKey = opp + 'total';

    /** @type {number} */
    let catTotal;
    /** @type {number} */
    let oppTotal;

    if (dir === UP) {
      catTotal = await this.#db.incr(catTotalKey, '1');
    } else {
      catTotal = await this.#db.decr(catTotalKey, '1');
    }

    try {
      const result = await this.#db.read(oppTotalKey, '1');
      if (typeof result !== 'number') {
        throw TypeError('Invalid value in database');
      }
      oppTotal = result;
    } catch (err) {
      if (err instanceof NoSuchThingError) {
        oppTotal = 0;
      } else {
        throw err;
      }
    }

    return Promise.all(tokens.map(token => this.#updateTokenCount(cat, token, dir, catTotal, oppTotal)));
  }

  swap (cat, tokens, callback) {
    const filter = this;
    const opp = this.opposite(cat);
    const catTotalKey = cat + 'total';
    const oppTotalKey = opp + 'total';
    let catTotal; let oppTotal;

    Step(
      function () {
        filter.db.incr(catTotalKey, 1, this);
      },
      function (err, result) {
        if (err) throw err;
        catTotal = result;
        filter.db.decr(oppTotalKey, 1, this);
      },
      function (err, result) {
        let i; const group = this.group();
        if (err) {
          if (err instanceof NoSuchThingError) {
            oppTotal = 1;
          } else {
            throw err;
          }
        } else {
          oppTotal = result;
        }
        for (i in tokens) { // Not sure I love this
          filter.swapTokenCount(cat, tokens[i], catTotal, oppTotal, group());
        }
      },
      function (err, results) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, results);
        }
      }
    );
  }


  /**
   * @param {SpamFilterCategory} cat
   * @param {string[]} tokens
   */
  async learn (cat, tokens) { // forget that tokens mean cat
    return this.#updateTokenCounts(cat, tokens, UP);
  }

  /**
   * @param {SpamFilterCategory} cat
   * @param {string[]} tokens
   */
  async forget (cat, tokens) { // forget that tokens mean cat
    return this.#updateTokenCounts(cat, tokens, DOWN);
  }

  /**
   * @param {SpamFilterCategory} cat
   * @param {string} token
   * @param {UP|DOWN} dir
   * @param {number} catTotal
   * @param {number} oppTotal
   */
  async #updateTokenCount (cat, token, dir, catTotal, oppTotal) {
    const opp = this.opposite(cat);

    /** @type {number} */
    let catCount;
    /** @type {number} */
    let oppCount;

    if (dir === UP) {
      catCount = await this.#db.incr(cat, token);
    } else {
      catCount = await this.#db.decr(cat, token);
    }

    try {
      const result = await this.#db.read(opp, token);
      if (typeof result !== 'number') {
        throw TypeError('Invalid value in database');
      }
      oppCount = result;
    } catch (err) {
      if (err instanceof NoSuchThingError) {
        oppCount = 0;
      } else {
        throw err;
      }
    }

    if (cat === 'spam') {
      return this.updateTokenProb(token, catCount, oppCount, catTotal, oppTotal);
    } else {
      return this.updateTokenProb(token, oppCount, catCount, oppTotal, catTotal);
    }
  }

  swapTokenCount (cat, token, catTotal, oppTotal, callback) {
    const opp = this.opposite(cat);
    const filter = this;
    let catCount; let oppCount;

    Step(
      function () {
        filter.db.incr(cat, token, this);
      },
      function (err, result) {
        if (err) throw err;
        catCount = result;
        filter.db.decr(opp, token, this);
      },
      function (err, result) {
        if (err instanceof NoSuchThingError) {
          oppCount = 0;
        } else if (err) {
          callback(err, null);
        } else {
          oppCount = result;
        }

        if (cat === 'spam') {
          filter.updateTokenProb(token, catCount, oppCount, catTotal, oppTotal, callback);
        } else {
          filter.updateTokenProb(token, oppCount, catCount, oppTotal, catTotal, callback);
        }
      }
    );
  }

  /**
   * @param {string} token
   * @param {number} spamCount
   * @param {number} hamCount
   * @param {number} spamTotal
   * @param {number} hamTotal
   * @returns {Promise<number | undefined>}
   */
  async updateTokenProb (token, spamCount, hamCount, spamTotal, hamTotal) {
    const g = 2 * hamCount;
    const b = spamCount;

    if (g + b > 5 && spamTotal !== 0 && hamTotal !== 0) {
      const p = Math.max(MINPROB,
        Math.min(MAXPROB,
          Math.min(1, b/spamTotal)/
            (Math.min(1, g/hamTotal) + Math.min(1, b/spamTotal))));

            await this.#db.save('prob', token, p);

      return p;
    }
  }

  /**
   * @template {string} T
   * @param {T[]} tokens
   * @returns {Promise<SpamFilterProbability<T>[]>}
   */
  async getProbabilities (tokens) {
    const probs = await this.#db.readAll('prob', tokens);

    /** @type {SpamFilterProbability<T>[]} */
    const probabilities = [];

    for (const token of tokens) {
      const tokenProbs = probs[token];

      // There's probably a nicer data structure for this
      if (tokenProbs === undefined) {
        probabilities.push([token, DEFAULT_PROB]);
      } else if (typeof tokenProbs === 'number') {
        probabilities.push([token, tokenProbs]);
      } else {
        throw new TypeError('Invalid data from the database');
      }
    }

    return probabilities;
  }

  /**
   * @template {string} T
   * @param {SpamFilterProbability<T>[]} probs
   * @returns {SpamFilterProbability<T>[]}
   */
  bestProbabilities (probs) {
    probs.sort((a, b) => {
      const adist = Math.abs(a[1] - 0.5);
      const bdist = Math.abs(b[1] - 0.5);

      if (adist > bdist) {
        return -1;
      } else if (bdist > adist) {
        return 1;
      } else {
        return 0;
      }
    });

    // Get the most relevant
    return probs.slice(0, Math.min(probs.length, RELEVANCE_CUTOFF));
  }

  /**
   * @param {SpamFilterProbability[]} probs
   * @returns {number}
   */
  combineProbabilities (probs) {
    const prod = probs.reduce((coll, cur) => coll * cur[1], 1.0);
    const invprod = probs.reduce((coll, cur) => coll * (1 - cur[1]), 1.0);

    //bounded values
    return Math.min(MAXPROB, Math.max(MINPROB, (prod)/(prod + invprod))); // really?
  }

  /**
   * @template {string} T
   * @param {T[]} tokens
   * @returns {Promise<SpamFilterDecision<T>>}
   */
  async test (tokens) {
    const start = Date.now();

    const probs = await this.getProbabilities(tokens);

    const bestKeys = this.bestProbabilities(probs);
    const probability = this.combineProbabilities(bestKeys);

    /** @type {SpamFilterDecision<T>} */
    const decision = {
      bestKeys,
      elapsed: Date.now() - start,
      isSpam: probability > SPAM_PROB,
      probability,
    };

    return decision;
  }

  train (cat, obj, app, callback) {

    const filter = this;
    const start = Date.now();
    const hash = filter.hashObject(obj);
    const tokens = Tokenizer.tokenize(obj);

    filter.db.read("trainrec", hash, function (err, trainrec) {
      if (err instanceof NoSuchThingError) { // Never trained before
        filter.learn(cat, tokens, function (err, results) {
          if (err) {
            callback(err, null);
          } else {
            trainrec = {cat: cat,
              object: JSON.stringify(obj),
              date: dateFormat(new Date(), "isoDateTime", true),
              app: app.id,
              elapsed: Date.now() - start};
            filter.db.save("trainrec", hash, trainrec, callback);
          }
        });
      } else if (err) { // DB error
        callback(err, null);
      } else if (trainrec.cat === cat) { // trained same; return old training info
        callback(null, trainrec);
      } else if (trainrec.cat === filter.opposite(cat)) { // trained opposite
        // XXX: Do these need to be sequenced...?
        filter.swap(cat, tokens, function (err, results) {
          if (err) {
            callback(err, null);
          } else {
            trainrec = {cat: cat,
              object: JSON.stringify(obj),
              date: dateFormat(new Date(), "isoDateTime", true),
              app: app.id,
              elapsed: Date.now() - start};
            filter.db.save("trainrec", hash, trainrec, callback);
          }
        });
      }
    });
  }

  hashObject (obj) {
    let dig = null;
    const str = JSON.stringify(obj); // Canonicalize? Fuzz? BOTH!?
    const hash = crypto.createHash('md5'); // XXX: might not be there!
    hash.update(str);
    dig = hash.digest('base64');
    // URL-safe
    dig = dig.replace(/\+/g, '-');
    dig = dig.replace(/\//g, '_');
    dig = dig.replace(/=/g, '');
    return dig;
  }

  schema: {'spam': {pkey: 'token'},
    'ham': {pkey: 'token'},
    'prob': {pkey: 'token'},
    'trainrec': {pkey: 'hash', indices: ['app']},
    'spamtotal': {pkey: 'service'},
    'hamtotal': {pkey: 'service'}}
};
