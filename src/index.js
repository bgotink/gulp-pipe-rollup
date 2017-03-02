import duplexify from 'duplexify';

import StoreFileStream from './streams/file-store';
import RollupResultStream from './streams/rollup-result';

import { rollup } from 'rollup';
import File from 'vinyl';

class LoadVinylFilesPlugin {
  /**
   * @param {Map<string, File>} files
   * @param {Map<string, Function[]>} listeners
   */
  constructor(files, listeners) {
    this._files = files;
    this._listeners = listeners;

    /** @type {boolean} */
    this._fileStreamEnded = false;

    /** @type {boolean} */
    this._entryFileSet = false;
    /** @type {File|null} */
    this._entryFile = undefined;

    this.load = this._load.bind(this);
  }

  markFileStreamEnded() {
    this._fileStreamEnded = true;
  }

  get entryFile() {
    return this._entryFile;
  }

  /**
   * @param {string} path
   * @return {Promise<string|null>}
   */
  _load(path) {
    // console.log('asking for %s', path);
    if (this._files.has(path)) {
      const file = this._files.get(path);

      if (!this._entryFileSet) {
        // The entry file is the first one used
        this._entryFile = file;
        this._entryFileSet = true;
      }

      // console.log('returning file %s from cache', path);

      return Promise.resolve(file.contents.toString());
    }

    if (this._fileStreamEnded) {
      // console.log('returning null for %s, file stream has ended', path);
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

      // console.log('awaiting file %s', path)

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