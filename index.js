import { Readable, Writable } from 'stream';
import duplexify from 'duplexify';

import { rollup } from 'rollup';
import File from 'vinyl';

class StoreFileStream extends Writable {
  constructor(files, listeners) {
    super({ objectMode: true, highWaterMark: 16 });

    this._files = files;
    this._listeners = listeners;

    this.on('end', () => this._onEnd());
  }

  _write(file, encoding, cb) {
    const { path } = file;

    if (this._listeners.has(path)) {
      this._listeners.get(path).forEach(listener => listener(file));
      this._listeners.delete(path);
    }

    this._files.set(path, file);

    cb();
  }

  _onEnd() {
    for (let l of this._listeners.values()) {
      l.forEach(listener => listener(null));
    }

    this._listeners.clear();
  }
}

class RollupResultStream extends Readable {
  constructor() {
    super({ objectMode: true });
  }

  _read() {
    // NOP
  }

  pushResultFile(file) {
    this.push(file);
    this.push(null);
  }
}

class LoadVinylFilesPlugin {
  constructor(files, listeners) {
    this._files = files;
    this._listeners = listeners;

    this._fileStreamEnded = false;

    this._entryFileSet = false;
    this._entryFile = undefined;

    this.load = this._load.bind(this);
  }

  markFileStreamEnded() {
    this._fileStreamEnded = true;
  }

  get entryFile() {
    return this._entryFile;
  }

  _load(path) {
    if (this._files.has(path)) {
      const file = this._files.get(path);

      if (!this._entryFileSet) {
        // The entry file is the first one used
        this._entryFile = file;
        this._entryFileSet = true;
      }

      return Promise.resolve(file.contents.toString());
    }

    if (this._fileStreamEnded) {
      return Promise.resolve(null);
    }

    return new Promise(resolve => {
      if (!this._listeners.has(path)) {
        this._listeners.set(path, []);
      }

      if (!this._entryFileSet) {
        this._listeners.get(path).push(file => {
          this._entryFile = file
        });
        this._entryFileSet = true;
      }

      this._listeners.get(path).push(file => resolve(file && file.contents.toString()));
    });
  }
}

export default function gulpRollup(config) {
  /** @type {Map<string, Function[]>} */
  const listeners = new Map();
  /** @type {Map<string, File>} */
  const files = new Map();

  const writableStream = new StoreFileStream(files, listeners);
  const readableStream = new RollupResultStream();

  const rollupPlugin = new LoadVinylFilesPlugin(files, listeners);

  writableStream.on('end', () => rollupPlugin.markFileStreamEnded());

  config = Object.assign({}, config);
  config.plugins = config.plugins ? [ rollupPlugin ].concat(config.plugins) : [ rollupPlugin ];

  rollup(config)
    .then(bundle => {
      const { format } = config;
      const sourceMap = config.sourceMap ? 'inline' : false;

      return bundle.generate({ format, sourceMap });
    }).then(generatedBundle => {
      const path = config.entry;

      const { code, map } = generatedBundle;

      return new File({
        path,
        base: rollupPlugin.entryFile && rollupPlugin.entryFile.base,
        contents: new Buffer(code),
        sourceMap: map
      });
    })
    .then(file => {
      readableStream.pushResultFile(file);
    })
    .catch(e => {
      readableStream.emit('error', e);
      readableStream.push(null);
    });

  return duplexify.obj(writableStream, readableStream);
}