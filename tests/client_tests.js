var decorations = [];

function resetDecorations () {
  for (var i = 0; i < decorations.length; i++) {
    decorations[i].reset();
  }

  decorations = [];
}

function decorate (obj, method, wrapper) {
  var old = obj[method];
  
  obj[method] = function testWrapper () {
    wrapper.apply(this, arguments);
    return old.apply(this, arguments);
  };

  decorations.push({
    reset: function () {
      obj[method] = old;
    }
  });
}

function withCleanup (fn) {
  return function () {
    var res = fn.apply(this, arguments);
    if (Meteor.router) {
      Meteor.router.reset();
      delete Meteor.router;
    }

    resetDecorations();
    Meteor.flush();
    return res;
  };
}

/* don't register anything with pagejs for testing */
Meteor.PageRouter.Page.prototype._register = function () {};

Tinytest.add('MeteorExtensions', withCleanup(function (test) {
  /* API methods and properties have been set properly */
  test.instanceOf(Meteor.pages, Function);
  test.instanceOf(Meteor.PageRouter, Function);
  test.instanceOf(Meteor.go, Function);

  /* API method signatures */
  var myPages = {
    '/testgo': function () {
    }
  };

  decorate(Meteor.PageRouter, "pages", function (pages) {
    test.isEqual(pages, myPages);
  });

  var defaults = {
    layout: false
  };
  var router = Meteor.pages(myPages, { autoRender: false, defaults: defaults });
  test.isFalse(router.isRendered());
  test.equal(router.defaults, defaults);
}));

Tinytest.add('PageRouter.PageInvocation', withCleanup(function (test) {
  var routerOptions = {
    autoRender: false,
    autoStart: false,
    defaults: { layout: false }
  };

  var router = new Meteor.PageRouter(routerOptions);
  var page = new Meteor.PageRouter.Page(router, '/', function () {});
  var context = { params: {}, stop: function () {} };
  var invocation = new Meteor.PageRouter.PageInvocation(router, page, context);

  /* constructor signature */
  test.equal(invocation.context, context);
  test.equal(invocation.params, context.params);
  test.equal(invocation.page, page);

  /* dynamic templates, layouts and nav */
  invocation.layout("layout");
  var layout = invocation.layout();
  test.equal(layout, "layout");

  invocation.template("template");
  var template = invocation.template();
  test.equal(template, "template");

  invocation.nav("nav");
  var nav = invocation.nav();
  test.equal(nav, "nav");


  /* done() method */
  invocation.done();
  test.isTrue(invocation.isDone());
  invocation._done = false;

  /* stop() method */
  invocation.stop();
  test.isTrue(invocation.isStopped());
  test.isTrue(invocation.isDone());
  test.isFalse(goCalled);
  invocation._stopped = false;

  /* redirect() method */
  var path = "/somepath",
      state = {};

  var goArgs = [], goCalled = false;
  var oldGo = router.go;
  router.go = function () {
    goArgs = _.toArray(arguments);
    goCalled = true;
  };
  invocation.redirect(path, state);
  test.isTrue(goCalled);
  test.equal(goArgs[0], path);
  test.equal(goArgs[1], state);
  test.isTrue(invocation.isStopped());
  router.go = oldGo;

  /* get, set, and toObject methods */
  invocation.set("key1", "value1");
  var result = invocation.get("key1");
  test.equal(result, "value1");

  invocation.set("key2", "value2");
  result = invocation.get("key2");
  test.equal(result, "value2");

  result = invocation.toObject();
  test.equal(result.key1, "value1");
  test.equal(result.key2, "value2");
}));

Tinytest.add('PageRouter.Page', withCleanup(function (test) {
  var router = new Meteor.PageRouter({
    autoRender: false,
    autoStart: false,
    defaults: { layout: false }
  });

  var path = "/posts/:_id/edit";

  var options, page;

  /* page ctor with options object */
  options = {
    to: "template",
    as: "name",
    nav: "nav",
    layout: "layout",
    before: function () {}
  };

  page = new Meteor.PageRouter.Page(router, path, options);
  test.equal(page.defaultTemplate, options.to);
  test.equal(page.name, options.as);
  test.equal(page.defaultNav, options.nav);
  test.equal(page.defaultLayout, options.layout);
  test.length(page._beforeCallbacks, 1);

  /* page ctor with template name string */
  options = "template";
  page = new Meteor.PageRouter.Page(router, path, options);
  test.equal(page.defaultTemplate, options);

  /* page ctor with before filter function */
  options = function () {};
  page = new Meteor.PageRouter.Page(router, path, options);
  test.length(page._beforeCallbacks, 1);

  /* pathWithContext(context) method */
  page = new Meteor.PageRouter.Page(router, path, {});
  var path = page.pathWithContext({ _id: 1});
  test.equal(path, "/posts/1/edit");

  /* pathWithContext with undefined context */
  page = new Meteor.PageRouter.Page(router, '/home');
  var path = page.pathWithContext();
  test.equal(path, "/home");

  /* path helper methods */
  path = '/posts/:_id/edit';

  var args = [], onAttachPathHelperCalled = false;
  decorate(Meteor.PageRouter, "onAttachPathHelper", function () {
    onAttachPathHelperCalled = true;
    args = _.toArray(arguments);
  });

  page = new Meteor.PageRouter.Page(router, path);
  page.as("postEdit");

  test.isTrue(onAttachPathHelperCalled);
  test.length(args, 2);

  /* onAttachPathHelper gets the name of the helper as the first parameter */
  test.equal(args[0], "postEditPath");

  /* onAttachPathHelper gets a function to call as the second parameter */
  test.instanceOf(args[1], Function);

  var ctx = { _id: 1 };

  /* path helper gets added to Meteor namespace */
  var res = Meteor.postEditPath(ctx);
  test.equal(res, "/posts/1/edit");

  var ctx = { stop: function () {}, params: [] };

  /* test run with an invocation instance */
  var cb1 = false, cb2 = false, thisArg = null;
  options = {
    before: [
      function () { cb1 = true; thisArg = this; },
      function () { cb2 = true; }
    ]
  };

  var page = new Meteor.PageRouter.Page(router, path, options);
  var invocation = new Meteor.PageRouter.PageInvocation(router, page, ctx);
  var result = page.run(invocation);

  test.equal(result, invocation);
  test.isTrue(cb1);
  test.isTrue(cb2);

  /* make sure `this` inside callbacks is an instance of PageInvocation */
  test.instanceOf(thisArg, Meteor.PageRouter.PageInvocation);

  /* test default template, nav and layout gets set on invocation from page */
  var options = {
    to: "template",
    nav: "nav",
    layout: "layout",
    before: []
  };
  page = new Meteor.PageRouter.Page(router, path, options);
  invocation = new Meteor.PageRouter.PageInvocation(router, page, ctx);
  page.run(invocation);

  test.equal(invocation.template(), options.to);
  test.equal(invocation.nav(), options.nav);
  test.equal(invocation.layout(), options.layout);

  /* test done() prevents downstream before callbacks */

  cb1 = false;
  cb2 = false;
  options = {
    before: [
      function () { cb1 = true; this.done(); },
      function () { cb2 = true; }
    ]
  };

  page = new Meteor.PageRouter.Page(router, path, options);
  invocation = new Meteor.PageRouter.PageInvocation(router, page, ctx);
  page.run(invocation);

  test.isTrue(cb1);
  test.isFalse(cb2);
  test.isTrue(invocation.isDone());

  /* test stop() prevents downstream callbacks and marks as stopped */
  cb1 = false;
  cb2 = false;
  options = {
    before: [
      function () { cb1 = true; this.stop(); },
      function () { cb2 = true; }
    ]
  };

  page = new Meteor.PageRouter.Page(router, path, options);
  invocation = new Meteor.PageRouter.PageInvocation(router, page, ctx);
  page.run(invocation);

  test.isTrue(cb1);
  test.isFalse(cb2);
  test.isTrue(invocation.isDone());
  test.isTrue(invocation.isStopped());

  /* double check that redirect stops downstream callbacks */

  var oldGo = Meteor.PageRouter.prototype.go;
  Meteor.PageRouter.prototype.go = function () {
  };

  cb1 = false;
  cb2 = false;
  options = {
    before: [
      function () { cb1 = true; this.redirect('/', {}); },
      function () { cb2 = true; }
    ]
  };

  page = new Meteor.PageRouter.Page(router, path, options);
  invocation = new Meteor.PageRouter.PageInvocation(router, page, ctx);
  page.run(invocation);

  test.isTrue(cb1);
  test.isFalse(cb2);
  test.isTrue(invocation.isDone());
  test.isTrue(invocation.isStopped());

  Meteor.PageRouter.prototype.go = oldGo;
}));

Tinytest.add("PageRouter", function (test) {

  var mockContext = {
    stop: function () {},
    params: {}
  };

  var router = new Meteor.PageRouter({autoRender: false, autoStart: false});
  var homePage = router.match('/').to('home').layout('layout');

  var pages = {
    home: router.match('/').to('home').layout('layout'),
    postShow: router.match('/posts/:_id').to('postShow').layout('layout'),
    postShowAlternateLayout: router.match('/alternate').to('postShow').layout('anotherLayout')
  };

  var templateCounters = {
    home: 0,
    postShow: 0,
    layout: 0,
    anotherLayout: 0
  };

  /* keep track of how many times a template function is called */
  _.each(templateCounters, function (count, name) {
    decorate(Template, name, function () {
      templateCounters[name] = templateCounters[name] + 1;
    });
  });

  routerDiv = OnscreenDiv(Meteor.render(_.bind(router.render, router)));

  router.run('/', pages.home, mockContext);
  Meteor.flush();
  test.equal(templateCounters.home, 1);
  test.equal(templateCounters.layout, 1);

  router.run('/posts/1', pages.postShow, mockContext);
  Meteor.flush();
  test.equal(templateCounters.layout, 1);
  test.equal(templateCounters.postShow, 1);

  router.run('/postShowAlternateLayout', pages.postShowAlternateLayout, mockContext);
  Meteor.flush();
  test.equal(templateCounters.anotherLayout, 1);
  test.equal(templateCounters.postShow, 2);
});
