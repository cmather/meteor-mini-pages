Package.describe({
  summary: "Simple client side routing"
});

Package.on_use(function (api, where) {
  api.use([
    'deps',
    'startup',
    'session',
    'underscore',
    'templating',
    'handlebars',
    'page-js-ie-support'
  ], 'client' );

  api.use('HTML5-History-API', 'client', {weak: true});

  api.add_files([
    'lib/mini-pages.js',
    'lib/helpers.js'
  ], 'client');

  if (typeof api.export !== 'undefined') {
    api.use('webapp', 'server');
  }
});

Package.on_test(function (api) {
  api.use('mini-pages', ['client', 'server']);
  api.use('test-helpers', ['client', 'server']);
  api.use('tinytest', ['client', 'server']);

  api.add_files([
    'tests/test_templates.html',
    'tests/client_tests.js'
  ], 'client');
});
