module.exports = function (grunt) {
  grunt.initConfig({

  concat: {
    rtc2sip: {
      src: [
	"js/vendor/*.js",
	"js/lib/*.js"
      ],
      dest: 'dist/rtc2sip.js'
    }
  },
  uglify: {
    options: {
      sourceMap: true
    },
    rtc2sip: {
      files: {
        'dist/rtc2sip.min.js': [ 'dist/rtc2sip.js' ]
      }
    }
  }
});

// load plugins
grunt.loadNpmTasks('grunt-contrib-concat');
grunt.loadNpmTasks('grunt-contrib-uglify');

// register at least this one task
grunt.registerTask('default', [  'concat', 'uglify' ]);

};
