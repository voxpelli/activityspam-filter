/** @typedef {import('type-fest').JsonValue} JsonValue */

/**
 * @typedef SimpleDatabank
 * @property {(type: string, id: string) => Promise<number>} incr
 * @property {(type: string, id: string) => Promise<number>} decr
 * @property {(type: string, id: string) => Promise<JsonValue>} read
 * @property {(type: string, ids: string[]) => Promise<{ [id: string]: JsonValue }>} readAll
 * @property {(type: string, id: string, value: JsonValue) => Promise<void>} update
 * @property {(type: string, id: string, value: JsonValue) => Promise<void>} create
 * @property {(type: string, id: string, value: JsonValue) => Promise<void>} save
 */

export class NoSuchThingError extends Error {
  /**
   * @param {string} type
   * @param {string} id
   */
  constructor (type, id) {
    super();

    this.name = 'NoSuchThingError';
    this.type = type;
    this.id = id;
    this.message = `No such '${type}' with id '${id}'`;
  }
}

export class AlreadyExistsError extends Error {
  /**
   * @param {string} type
   * @param {string} id
   */
  constructor (type, id) {
    super();

    this.name = 'AlreadyExistsError';
    this.type = type;
    this.id = id;
    this.message = `Already have a(n) '${type}' with id '${id}'`;
  }
}
