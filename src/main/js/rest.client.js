(function () {
    angular.module('rest.client', ['notifications'])
        .factory('restDefaultHeaderMappers', [function(){return [];}])
        .factory('installRestDefaultHeaderMapper', ['restDefaultHeaderMappers', InstallRestdefaultHeaderMapperFactory])
        .factory('restServiceHandler', ['$http', '$location', 'topicMessageDispatcher', 'restDefaultHeaderMappers', RestServiceHandlerFactory])
        .factory('scopedRestServiceHandler', ['restServiceHandler', ScopedRestServiceHandlerFactory]);

    function InstallRestdefaultHeaderMapperFactory(restDefaultHeaderMappers) {
        return function(mapper) {
            restDefaultHeaderMappers.push(mapper);
        }
    }

    function RestServiceHandlerFactory($http, $location, topicMessageDispatcher, restDefaultHeaderMappers) {
        return function (ctx) {
            var onError = function (body, status) {
                if(status != 0 && status != -1) {
                    if(status == 404) {
                        if(ctx.notFound) ctx.notFound();
                    } else if (status == 412) {
                        ctx.rejected(body);
                    } else if (status == 401 || status == 403)
                        topicMessageDispatcher.fire('checkpoint.auth.required', $location.path());
                    else
                        topicMessageDispatcher.fire('system.alert', status);
                }
                if (ctx.error) ctx.error();
                if (ctx.stop) ctx.stop();
            };
            var onSuccess = function (payload) {
                if (ctx.success) ctx.success(payload);
                if (ctx.stop) ctx.stop();
            };

            if (ctx.reset) ctx.reset();
            if (ctx.start) ctx.start();
            ctx.params.headers = restDefaultHeaderMappers.reduce(function(p, c) {
                return c(p);
            }, ctx.params.headers || {});
            return $http(ctx.params).error(onError).success(onSuccess);
        };
    }

    function ScopedRestServiceHandlerFactory(restServiceHandlerFactory) {
        return function (ctx) {
            var $scope = ctx.scope;
            ctx.start = function () {
                $scope.working = true;
            };
            ctx.stop = function () {
                $scope.working = false;
            };
            ctx.reset = function () {
                $scope.errorClassFor = {};
                $scope.violations = {};
            };
            ctx.rejected = function (violations) {
                Object.keys(violations).forEach(function (k) {
                    $scope.errorClassFor[k] = violations[k] ? 'error' : '';
                    $scope.violations[k] = violations[k];
                });
            };
            restServiceHandlerFactory(ctx);
        };
    }
})();