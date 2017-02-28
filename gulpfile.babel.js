import gulp from 'gulp';
import rollup from './index';

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