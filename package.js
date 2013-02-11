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
    'page-js'
  ], 'client');

  api.add_files(['mini-pages.js', 'helpers.js'], 'client');
});

Package.on_test(function (api) {
  api.use('mini-pages', ['client', 'server']);
  api.use('test-helpers', ['client', 'server']);
  api.use('tinytest', ['client', 'server']);

  api.use('session', 'client');
  api.add_files('tests/client_test.js', 'client');
});
