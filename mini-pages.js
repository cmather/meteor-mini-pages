(function () {
  
  /* page-js enhancements */

  /* modify page-js to not push a route if the context is stopped */
  page.Context.prototype.save = function () {
    if (!this.stopped)
      history.replaceState(this.state, this.title, this.canonicalPath);
  };

  /* Provide a stop() method in a page-js Context instance */
  page.Context.prototype.stop = function () {
    this.stopped = true;
    this.unhandled = true;
  };

  /* in our before filters we can redirect without worrying
   * about stopping the context
   *
   */
  page.Context.prototype.redirect = function (path, state) {
    this.stop();
    Meteor.go(path, state);
  };

  /* end page-js enhancements */


  /**
   * Add path helpers to template engine and the Meteor namespace. Path
   * helpers will look like: {{showPostPath post}} or Meteor.showPostPath({});
   * @api private
   * @param {String} helperName Name of the helper method.
   * @param {Page} page The Page instance.
   */
  function attachPathHelpers(helperName, page) {
    if (!PageRouter.onAttachPathHelper)
      throw new Error('Your template engine might not be supported in the ' +
                      'mini-pages package. Could not find PageRouter.' +
                      'onAttachPathHelper which is normally defined in ' +
                      'the mini-pages/helpers.js file');

    if (!Meteor[helperName]) {
      var helper = function (context) {
        return page.pathWithContext(context);
      };

      Meteor[helperName] = helper;
      PageRouter.onAttachPathHelper(helperName, helper);
    }
  }

  /**
   * PageRouter manages all of an application's registered pages.
   * @api public
   * @return {Object} PageRouter instance.
   */
  var PageRouter = function () {
    this._page = null;
    this._context = {};
    this._pages = {};
    this._currentPageContexts = new Meteor.deps._ContextSet;
  };

  PageRouter.prototype = {
    constructor: PageRouter,

    /**
     * Create page routes. Example:
     *
     * Meteor.pages({
     *  '/' : { to: 'templateName', as: 'pathHelperName', nav: 'navBar', before: [setPost] },
     *  '*' : '404' 
     * });
     *
     * See the Page prototype for various route options.
     *
     * @api public
     * @param {Object} routes An object with routes as keys and Page constructor
     * parameters as values. Values can either be a string (template name) or
     * a config object that will be passed to the Page constructor.
     * @return {PageRouter} Returns the PageRouter instance (self).
     */
    pages: function (routes) {
      var self = this;

      _.each(routes, function (config, path) {
        var page = new Page(self, path, config);
        self._pages[page.name] = page;
      });

      return self;
    },

    /**
     * Returns the current page. Reactive.
     * @api public
     * @return {Page} An instance of the Page constructor.
     */
    page: function () {
      this._currentPageContexts.addCurrentContext();
      return this._page;
    },

    /**
     * Proxy to the page(path, state) method and route to the given
     * path, passing an optional state object.
     * @api public
     * @param {String} path A path such as '/posts/5'
     * @param {Object} state (Optional) state object that will get passed to
     *                       before filters and set in pushState.
     */
    go: function (path, state) {
      return page(path, state);
    },

    /**
     * Sets the current page and Session values, and reactively calls
     * the run method of the page. That in turn runs the before callbacks
     * and renders the page to the body of the document. Should not be called
     * directly.
     * @api protected
     * @param {Page} nextPage The page instance to run.
     * @param {page.Context} context The context created from page-js.
     */
    run: function (nextPage, context) {
      var self = this;

      if (self._page !== nextPage ||
          !_.isEqual(self._context,context)) {
        self._page = nextPage;
        self._context = context;
        self._currentPageContexts.invalidateAll();
        
        if (self._pageHandle) self._pageHandle.stop();

        Session.set("page", nextPage.name);
        Session.set("nav", nextPage.nav);

        Meteor.autorun(function (handle) {
          self._pageHandle = handle;
          nextPage.run(context);
        });
      }
    }
  };

  /**
   * Page holds all the information associated with a particular route,
   * including before callbacks, nav, name, route and layout properties, and
   * methods like pathWithContext.
   *
   * Example:
   *
   * var page = new Page(Meteor.router, '/posts/:_id', {
   *  to: 'templateName',
   *  as: 'somePathName',
   *  nav: 'a nav key for use with top nav bars',
   *  before: [authorize, setPost]
   * });
   *
   * Or with a string template name as the third parameter:
   *
   * var page = new Page(Meteor.router, '/posts/:_id', 'showPost');
   *
   *
   * @api public
   * @param {PageRouter} router A PageRouter instance.
   * @param {String|RegExp} path A string or regular expression path.
   * @param {Object|String} options An options object or a string template name.
   *
   */
  var Page = function (router, path, options) {
    this.router = router;
    this.path = path;
    this.isRouteCreated = false;
    this.route = null;

    if (! (router instanceof PageRouter))
      throw new Error('First parameter to Page ctor must be an instance of' +
        'Pages');
    if (!(_.isString(path) || _.isRegExp(path)))
      throw new Error('path parameter to Page ctor must be a string or regex');

    if (_.isString(options)) {
      options = { to: options };
    } else if (_.isObject(options) && !options.to) {
      throw new Error('Options in Page ctor must contain a "to"' +
        'property specifying a template name');
    }

    if (typeof options.layout === 'undefined' && Template.layout) {
      this.withLayout('layout');
    } else if (options.layout) {
      this.withLayout(options.layout);
    }

    if (options.before) this.before(options.before);
    if (options.nav) this.withNav(options.nav);
    if (options.to) this.to(options.to);

    /* default to the template name for path helpers */
    this.as( options.as ? options.as : options.to );
  };

  Page.prototype = {
    constructor: Page,

    /**
     * Proxy the route setup to the page handler. Can only be called once.
     * @api public
     * @param {String} templateName The name of the template to render.
     * @return {Page} The Page instance for chainability.
     */
    to: function (templateName) {
      var pageHandler,
          setPage,
          self = this;

      if (this.isRouteCreated) {
        throw new Error('Page has already been created. You can only ' +
          'call the "to" method once.');
      }

      if (!_.isFunction(Template[templateName]))
        throw new Error('No template found named ' + templateName + '. ' +
                      ' Are you sure you defined it?');


      // XXX Remove page-js dependency at some point.
      this.route = new page.Route(this.path);

      this.templateName = templateName;

      pageHandler = function (context, next) {
        self.router.run(self, context);
      };

      page.call(this, this.path, pageHandler);
      this.isRouteCreated = true;

      return this;
    },

    /**
     * Name the page
     * @api public
     * @param {String} name The name of the page if different from the template.
     * @return {Page} The Page instance for chainability.
     */
    as: function (name) {
      this.name = name;
      attachPathHelpers(name + 'Path', this);
      return this;
    },

    /**
     * Specify a nav key. This can be useful when you want to highlight
     * a top nav bar and a few different templates will use the same
     * nav bar menu item. This can be used in combination with a Handlebars
     * helper like this: {{nav}} or {{navIs 'posts'}}.
     * @api public
     * @param {String} nav The name for the nav value.
     * @return {Page} The Page instance for chainability.
     */
    withNav: function (nav) {
      this.nav = nav;
      return this;
    },

    /**
     * Specifies a layout for the page. Pages will be rendered inside their
     * layouts inside the {{{yield}}} expression.
     * @api public
     * @param {String} templateName The name of the layout template.
     * @return {Page} The Page instance for chainability.
     */
    withLayout: function (templateName) {
      if (!Template[templateName])
        throw new Error("Couln't find a layout template with name " + 
          templateName + ". Are you sure you defined one?");

      this.layoutTemplateName = templateName;
      return this;
    },

    /**
     * Sets the before callbacks which are run reactively before the page
     * is rendered.
     * @api public
     * @param {Array|Function} callbacks A function or array of functions to
     * be called before the page is rendered. These can be used to set Session
     * values for example.
     */
    before: function (callbacks) {
      this.beforeCallbacks = _.isArray(callbacks) ? callbacks : [callbacks];
      return this;
    },

    /**
     * Given a context object returns a path for the page. Used in path helpers
     * that are automatically created as global handlebars helpers as well as
     * off the Meteor namespace.
     *
     * Example:
     *
     * var page = new Page(Meteor.router, '/posts/:_id', 'showPost');
     * var context = { _id: 123 };
     * var path = page.pathWithContext(context);
     * => /posts/123
     *
     * @api public
     * @param {Object} context A context object to interpolate the path with.
     * @return {String} The path to be used in a link.
     */
    pathWithContext: function (context) {
      var self = this;
      var route = self.route;
      var path = self.path;
      var parts = route.regexp.exec(route.path).slice(1);

      context = context || {};

      _.each(parts, function (part) {
        var re = new RegExp(part, "g");
        var prop = part.replace(":", "");
        var val;
        if (val = context[prop])
          path = path.replace(re, val);
        else
          path = path.replace(re, "");
      });

      return path;
    },

    /**
     * Run all the before callbacks and then render the page if the context
     * has not been stopped.
     * @api protected
     * @param {Object} context A context from page-js
     */
    run: function (context) {
      var beforeCallbacks = this.beforeCallbacks || [];

      context = context || {};

      for (var i = 0; i < beforeCallbacks.length; i++) {
        if (context.stopped) return;
        else beforeCallbacks[i].call(this, context, this);
      }

      if (!context.stopped) this.render();
    },

    /**
     * Render the page to the body. Includes support for templates using the
     * {{{yield}}} expression.
     * @api protected
     */
    render: function () {
      var self = this;

      var childFn = function () {
        var layoutFn,
            layoutName;

        layoutName = self.layoutTemplateName;

        layoutFn = Template[layoutName] ? Template[layoutName] :
          function (data) { return data["yield"](); };

        return layoutFn({
          "yield": function () {
            var childFn = Template[self.templateName];
            return Spark.isolate(childFn);
          }
        });
      };

      var frag = Meteor.render(childFn);
      document.body.innerHTML = "";
      document.body.appendChild(frag);
    }
  };

  Meteor.router = new PageRouter();

  /* The main API interface */
  _.extend(Meteor, {
    PageRouter  : PageRouter,
    pages       : _.bind(Meteor.router.pages, Meteor.router),
    page        : _.bind(Meteor.router.page, Meteor.router),
    go          : _.bind(Meteor.router.go, Meteor.router)
  });

  // XXX Hacky 
  // Give user code a chance to run before adding our callback to the
  // startup queue. This is to work around a bug in the coffeescript package
  // where Template is not defined at the time of coffeescript file compilation.
  
  Meteor.setTimeout(function () {
    Meteor.startup(function () {
      /* start things in motion with page-js */
      page();
    });
  }, 0);
}());
