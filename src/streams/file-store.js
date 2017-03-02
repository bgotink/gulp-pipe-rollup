import { Writable } from 'stream';

export default class StoreFileStream extends Writable {
  /**
   * @param {Map<string, File>} files
   * @param {Map<string, Function[]>} listeners
   */
  constructor(files, listeners) {
    super({ objectMode: true, highWaterMark: 16 });

    this._files = files;
    this._listeners = listeners;

    this.on('end', () => this._onEnd());
  }

  /**
   * @param {File} file
   * @param {string} encoding
   * @param {Function} cb
   */
  _write(file, encoding, cb) {
    const { path } = file;

    if (this._listeners.has(path)) {
      this._listeners.get(path).forEach(listener => listener(file));
      this._listeners.delete(path);
    }

    this._files.set(path, file);

    // console.log('got %s', path);

    cb(null);
  }

  _onEnd() {
    for (let l of this._listeners.values()) {
      l.forEach(listener => listener(null));
    }

    // console.log('file stream ended');

    this._listeners.clear();
  }
}