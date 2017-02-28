# `gulp-pipe-rollup`

This small gulp plugin add rollup support to gulp.

## Usage

Simply call the function you get when requiring this plugin
with your rollup config and pipe the sourcefiles into it.
This example comes from the gulpfile of this project:

```js
gulp.task('default', function () {
  return gulp.src('index.js')
    .pipe(rollup({
      entry: 'index.js',

      external: [
        'vinyl',
        'duplexify',
        'stream',
        'rollup'
      ],

      format: 'cjs',
    }))
    .pipe(gulp.dest('dist'));
});
```