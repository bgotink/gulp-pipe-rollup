import gulp from 'gulp';
import rollup from './src/index';

gulp.task('default', function () {
  return gulp.src('src/**/*')
    .pipe(rollup({
      entry: 'src/index.js',

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