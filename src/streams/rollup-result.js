import { Readable } from 'stream';

export default class RollupResultStream extends Readable {
  constructor() {
    super({ objectMode: true });
  }

  _read() {
    // NOP
  }

  /**
   * @param {File} file
   */
  pushResultFile(file) {
    this.push(file);
    this.push(null);
  }
}