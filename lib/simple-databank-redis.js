import ioredis from 'ioredis';

import {
  AlreadyExistsError,
  NoSuchThingError,
} from './simple-databank.js';

const { Redis } = ioredis;

/** @typedef {import('type-fest').JsonValue} JsonValue */

/**
 * @template {string} Type
 * @template {string} Id
 * @param {Type} type
 * @param {Id} id
 * @returns {`${type}:${id}`}
 */
function toKey (type, id) {
  return `${type}:${id}`;
}

/** @typedef {import('./simple-databank.js').SimpleDatabank} SimpleDatabank */

/**
 * @implements {SimpleDatabank}
 */
export class SimpleDatabankRedis {
  /** @type {import('ioredis').Redis} */
  #client;

  /**
   * @param {import('ioredis').RedisOptions} redisOptions
   */
  constructor (redisOptions) {
    this.#client = new Redis(redisOptions);
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {Promise<number>}
   */
  async incr (type, id) {
    return this.#client.incr(toKey(type, id));
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {Promise<number>}
   */
  async decr (type, id) {
    return this.#client.decr(toKey(type, id));
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {Promise<JsonValue>}
   */
  async read (type, id) {
    const value = await this.#client.get(toKey(type, id));

    if (value === null) {
      throw new NoSuchThingError(type, id);
    }

    return JSON.parse(value);
  }

  /**
   * @template {string} T
   * @param {string} type
   * @param {T[]} ids
   * @returns {Promise<{ [id: T]: JsonValue }>}
   */
  async readAll (type, ids) {
    const keys = ids.map(id => toKey(type, id));

    if (keys.length === 0) {
      return {};
    }
    const values = await this.#client.mget(keys);
    /** @type {Partial<Record<T, JsonValue>>} */
    const results = {};

    for (const [i, value] of values.entries()) {
      const id = ids[i];
      if (id && value !== null) {
        results[id] = JSON.parse(value);
      }
    }

    return results;
  }

  /**
   * @param {string} type
   * @param {string} id
   * @param {JsonValue} value
   * @returns {Promise<void>}
   */
  async update (type, id, value) {
    await this.#client.set(toKey(type, id), JSON.stringify(value));
  }

  /**
   * @param {string} type
   * @param {string} id
   * @param {JsonValue} value
   * @returns {Promise<void>}
   */
  async create (type, id, value) {
    const result = await this.#client.setnx(toKey(type, id), JSON.stringify(value));

    if (result === 0) {
      throw new AlreadyExistsError(type, id);
    }
  }

  /**
   * @param {string} type
   * @param {string} id
   * @param {JsonValue} value
   * @returns {Promise<void>}
   */
  async save (type, id, value) {
    try {
      await this.update(type, id, value);
    } catch (err) {
      if (err instanceof NoSuchThingError) {
        await this.create(type, id, value);
      } else {
        throw err;
      }
    }
  }
}
