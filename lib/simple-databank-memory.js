import {
  AlreadyExistsError,
  NoSuchThingError,
} from './simple-databank.js';

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
export class SimpleDatabankMemory {
  /** @type {Map<string, *>} */
  #memory;

  constructor () {
    this.#memory = new Map();
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {Promise<number>}
   */
  async incr (type, id) {
    const key = toKey(type, id);
    const newValue = (this.#memory.get(key) || 0) + 1;

    this.#memory.set(key, newValue);

    return newValue;
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {Promise<number>}
   */
  async decr (type, id) {
    const key = toKey(type, id);
    const newValue = (this.#memory.get(key) || 0) - 1;

    this.#memory.set(key, newValue);

    return newValue;
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {Promise<JsonValue>}
   */
  async read (type, id) {
    const value = this.#memory.get(toKey(type, id));

    if (value === undefined) {
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
    if (ids.length === 0) {
      return {};
    }

    const values = ids.map(
      id => this.#memory.get(toKey(type, id))
    );

    /** @type {Partial<Record<T, JsonValue>>} */
    const results = {};

    for (const [i, value] of values.entries()) {
      const id = ids[i];
      if (id && value !== undefined) {
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
    this.#memory.set(toKey(type, id), JSON.stringify(value));
  }

  /**
   * @param {string} type
   * @param {string} id
   * @param {JsonValue} value
   * @returns {Promise<void>}
   */
  async create (type, id, value) {
    const key = toKey(type, id);

    if (this.#memory.get(key) !== undefined) {
      throw new AlreadyExistsError(type, id);
    }

    this.#memory.set(key, JSON.stringify(value));
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
