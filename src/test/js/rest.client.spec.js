describe('rest-client', function () {
    var $httpBackend, scope, params, payload;
    var client;
    var dispatcher;

    var success = false;
    var error = false;
    var returnedStatus = 0;

    var onSuccess = function () {
        success = true;
    };

    var onError = function (body, status) {
        error = true;
        returnedStatus = status;
    };

    beforeEach(module('rest.client'));
    beforeEach(inject(function ($injector) {
        scope = {};
        params = {};
        payload = 'payload';
        dispatcher = {
            fire: function (topic, msg) {
                dispatcher[topic] = msg;
            }
        };
        $httpBackend = $injector.get('$httpBackend');
    }));
    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    describe('RestServiceHandlerFactory', function () {
        var handler, completed, notFound, violations;
        var working, failed, reset;

        beforeEach(inject(function ($controller, $http, $location, restDefaultHeaderMappers) {
            completed = undefined;
            violations = undefined;
            notFound = false;
            reset = false;
            working = false;
            failed = false;
            handler = RestServiceHandlerFactory($http, $location, dispatcher, restDefaultHeaderMappers);
        }));

        var invoke = function () {
            handler({
                scope: scope,
                params: {
                    method: 'PUT',
                    url: 'api/entity/catalog-partition',
                    data: {owner: 'type', name: 'name'}
                },
                reset: function () {
                    reset = true;
                },
                start: function () {
                    working = true;
                },
                stop: function () {
                    working = false;
                },
                error: function () {
                    failed = true;
                },
                notFound: function() {
                    notFound = true;
                },
                rejected: function (payload) {
                    violations = payload;
                },
                success: function (payload) {
                    completed = payload;
                }
            });
        };

        it('on submit performs put request', function () {
            $httpBackend.expect('PUT', 'api/entity/catalog-partition', {
                owner: 'type',
                name: 'name'
            }).respond(201);

            invoke();

            $httpBackend.flush();
        });

        it('reset event is raised before execution', function () {
            $httpBackend.expect('PUT', /.*/).respond(200);
            invoke();
            expect(reset).toEqual(true);
            $httpBackend.flush();
        });

        [200, 500].forEach(function (status) {
            it('working status', function () {
                $httpBackend.expect('PUT', /.*/).respond(status);
                invoke();
                expect(working).toEqual(true);
                $httpBackend.flush();
                expect(working).toEqual(false);
            });
        });

        it('error callback is invoked on failures', function () {
            $httpBackend.expect('PUT', /.*/).respond(500);
            invoke();
            $httpBackend.flush();
            expect(failed).toEqual(true);
        });

        [
            {status: 0, topic: 'system.alert'}
        ].forEach(function (el) {
                it('on submit receives ' + el.status + ' response', function () {
                    $httpBackend.expect('PUT', /.*/).respond(el.status);
                    invoke();
                    $httpBackend.flush();
                    expect(dispatcher[el.topic]).toEqual(el.status);
                });
            });

        [401, 403].forEach(function (status) {
                it('on auth rejected raise notification with current location path', inject(function ($location) {
                    $location.path('/current/path');
                    $httpBackend.expect('PUT', /.*/).respond(status);
                    invoke();
                    $httpBackend.flush();
                    expect(dispatcher['checkpoint.auth.required']).toEqual('/current/path');
                }));
            });

        describe('on HTTP 404', function() {
            beforeEach(function() {
                $httpBackend.expect('PUT', /.*/).respond(404);
                invoke();
                $httpBackend.flush();
            });

            it('send not found message', function() {
                expect(notFound).toEqual(true);
            });
        });

        it('violations can be retrieved when rejected', function () {
            $httpBackend.expect('PUT', /.*/).respond(412, {
                "field-with-violations": ["violation"]
            });
            invoke();
            $httpBackend.flush();
            expect(violations['field-with-no-violations']).toEqual(undefined);
            expect(violations['field-with-violations']).toEqual(['violation']);
        });

        it('a success handler is optional', function () {
            $httpBackend.expect('PUT', /.*/).respond(201, payload);
            handler({
                scope: scope,
                params: {
                    method: 'PUT',
                    url: 'api/entity/catalog-partition',
                    data: {owner: 'type', name: 'name'}
                }
            });
            $httpBackend.flush();
        });

        it('on submit success', function () {
            params.type = 'type';

            $httpBackend.expect('PUT', /.*/).respond(201, payload);
            invoke();
            $httpBackend.flush();

            expect(completed).toEqual(payload);
            expect(failed).toEqual(false);
        });

        it('optional headers can be provided', function () {
            var headers = {header: 'value'};
            var data = {owner: 'type', name: 'name'};

            $httpBackend.expect('PUT', /.*/, data, function(it) {
                return it['header'] == headers.header;
            }).respond(201, payload);

            handler({
                scope: scope,
                params: {
                    method: 'PUT',
                    url: 'api/entity/catalog-partition',
                    headers: headers,
                    data: data
                }
            });
            $httpBackend.flush();
        });

        describe('when installing a default header mapper', function() {
            beforeEach(inject(function(installRestDefaultHeaderMapper) {
                installRestDefaultHeaderMapper(function(headers) {
                    headers['default-header'] = 'default-header-value'
                    return headers;
                });
            }));

            it('then any headers set by the default header mappers is sent with every request', function() {
                $httpBackend.expect('GET', /.*/, null, function(it) {
                    return it['default-header'] == 'default-header-value'
                }).respond(200);
                handler({params:{method:'GET', url:'api/test'}});
                $httpBackend.flush();
            });

            it('then default header mappers do not overwrite custom headers', function() {
                $httpBackend.expect('GET', /.*/, null, function(it) {
                    return it['default-header'] == 'default-header-value' && it['custom-header'] == 'custom-header-value'
                }).respond(200);
                handler({params:{method:'GET', url:'api/test', headers:{'custom-header':'custom-header-value'}}});
                $httpBackend.flush();
            });
        });
    });

    describe('ScopedRestServiceHandlerFactory', function () {
        var handler, completed;

        beforeEach(inject(function ($controller, $http, $location, restDefaultHeaderMappers) {
            completed = undefined;
            handler = ScopedRestServiceHandlerFactory(RestServiceHandlerFactory($http, $location, dispatcher, restDefaultHeaderMappers));
        }));

        var invoke = function () {
            handler({
                scope: scope,
                params: {
                    method: 'PUT',
                    url: 'api/entity/catalog-partition',
                    data: {owner: 'type', name: 'name'}
                },
                success: function (payload) {
                    completed = payload;
                }
            });
        };

        it('on submit performs put request', function () {
            $httpBackend.expect('PUT', 'api/entity/catalog-partition', {
                owner: 'type',
                name: 'name'
            }).respond(201);

            invoke();

            $httpBackend.flush();
        });

        [200, 500].forEach(function (status) {
            it('working status', function () {
                $httpBackend.expect('PUT', /.*/).respond(status);
                invoke();
                expect(scope.working).toEqual(true);
                $httpBackend.flush();
                expect(scope.working).toEqual(false);
            });
        });

        [
            {status: 0, topic: 'system.alert'}
        ].forEach(function (el) {
                it('on submit receives ' + el.status + ' response', function () {
                    $httpBackend.expect('PUT', /.*/).respond(el.status);
                    invoke();
                    $httpBackend.flush();
                    expect(dispatcher[el.topic]).toEqual(el.status);
                });
            });

        it('error classes can be retrieved when rejected', function () {
            $httpBackend.expect('PUT', /.*/).respond(412, {
                "field-with-violations": ["violation"]
            });
            invoke();
            $httpBackend.flush();
            expect(scope.errorClassFor['field-with-no-violations']).toEqual(undefined);
            expect(scope.errorClassFor['field-with-violations']).toEqual('error');
        });

        it('violations can be retrieved when rejected', function () {
            $httpBackend.expect('PUT', /.*/).respond(412, {
                "field-with-violations": ["violation"]
            });
            invoke();
            $httpBackend.flush();
            expect(scope.violations['field-with-no-violations']).toEqual(undefined);
            expect(scope.violations['field-with-violations']).toEqual(['violation']);
        });

        it('rejections are reset on re-submit', function () {
            $httpBackend.expect('PUT', /.*/).respond(201);

            scope.errorClassFor = {
                "field-with-violations": 'error'
            };
            scope.violations = {
                "field-with-violations": ['violation']
            };

            invoke();

            expect(scope.errorClassFor).toEqual({});
            expect(scope.violations).toEqual({});
            $httpBackend.flush();
        });

        it('a success handler is optional', function () {
            $httpBackend.expect('PUT', /.*/).respond(201, payload);
            handler({
                scope: scope,
                params: {
                    method: 'PUT',
                    url: 'api/entity/catalog-partition',
                    data: {owner: 'type', name: 'name'}
                }
            });
            $httpBackend.flush();
        });

        it('on submit success', function () {
            params.type = 'type';

            $httpBackend.expect('PUT', /.*/).respond(201, payload);
            invoke();
            $httpBackend.flush();

            expect(completed).toEqual(payload);
        });
    });

    describe('requests without baseUri', function () {
        beforeEach(inject(function ($controller) {
            client = $controller(RestClient, {baseUri: null})
        }));

        it('successful request', function () {
            $httpBackend.expect('PUT', 'path', {key: 'value'}).respond(201);
            client.put('path', {key: 'value'}, onSuccess);
            $httpBackend.flush();
            expect(success).toBeTruthy();

            $httpBackend.expect('POST', 'path', {key: 'value'}).respond(200);
            client.post('path', {key: 'value'}, onSuccess);
            $httpBackend.flush();
            expect(success).toBeTruthy();

            $httpBackend.expect('DELETE', 'path', {key: 'value'}).respond(204);
            client.delete('path', {key: 'value'}, onSuccess);
            $httpBackend.flush();
            expect(success).toBeTruthy();

            $httpBackend.expect('GET', 'path').respond(200);
            client.get('path', onSuccess);
            $httpBackend.flush();
            expect(success).toBeTruthy();
        });

        it('failed request', function () {
            $httpBackend.expect('PUT', /.*/, {}).respond(500);
            client.put('path', {}, onSuccess, onError);
            $httpBackend.flush();
            expect(returnedStatus).toEqual(500);
            expect(error).toBeTruthy();

            $httpBackend.expect('POST', /.*/, {}).respond(500);
            client.post('path', {}, onSuccess, onError);
            $httpBackend.flush();
            expect(returnedStatus).toEqual(500);
            expect(error).toBeTruthy();

            $httpBackend.expect('DELETE', /.*/, {}).respond(500);
            client.delete('path', {}, onSuccess, onError);
            $httpBackend.flush();
            expect(returnedStatus).toEqual(500);
            expect(error).toBeTruthy();

            $httpBackend.expect('GET', /.*/).respond(500);
            client.get('path', onSuccess, onError);
            $httpBackend.flush();
            expect(returnedStatus).toEqual(500);
            expect(error).toBeTruthy();
        });
    });

    describe('requests with baseUri', function () {
        beforeEach(inject(function ($controller) {
            client = $controller(RestClient, {baseUri: 'base-uri'})
        }));

        it('prepend base-uri while appending slash', function () {
            $httpBackend.expect('PUT', 'base-uri/path', {key: 'value'}).respond(201);
            client.put('path', {key: 'value'}, onSuccess);
            $httpBackend.flush();
        });
    });

    describe('requests with baseUri with trailing slash', function () {
        beforeEach(inject(function ($controller) {
            client = $controller(RestClient, {baseUri: 'base-uri/'})
        }));

        it('prepend base-uri without appending slash', function () {
            $httpBackend.expect('PUT', 'base-uri/path', {key: 'value'}).respond(201);
            client.put('path', {key: 'value'}, onSuccess);
            $httpBackend.flush();
        })
    });

});
