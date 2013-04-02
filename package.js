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
    'page-js-ie-support'
  ], 'client');

  api.add_files(['lib/mini-pages.js', 'lib/helpers.js'], 'client');
});

Package.on_test(function (api) {
  api.use('mini-pages', ['client', 'server']);
  api.use('test-helpers', ['client', 'server']);
  api.use('tinytest', ['client', 'server']);

  api.add_files(['tests/test_templates.html', 'tests/client_tests.js'], 'client');
});
