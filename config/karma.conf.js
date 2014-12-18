module.exports = function(config) {
    config.set({
        basePath:'../',
        frameworks:['jasmine'],
        files:[
            {pattern:'bower_components/angular/angular.js'},
            {pattern:'bower_components/angular-mocks/angular-mocks.js'},
            {pattern:'src/main/js/**/*.js'},
            {pattern:'src/test/js/**/*.js'}
        ],
        browsers:['PhantomJS']
    });
};