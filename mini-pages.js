(function () {
  
  /* modify page-js to not push a route if the context is stopped */
  page.Context.prototype.save = function () {
    if (!this.stopped)
      history.replaceState(this.state, this.title, this.canonicalPath);
  };

  /* Provide a stop() method in a page-js Context instance */
  page.Context.prototype.stop = function () {
    this.stopped = true;
  };

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
    this._pages = {};
  };

  PageRouter.prototype = {
    constructor: PageRouter,

    /**
     * Create a bunch of page routes at once.
     * @api public
     * @param {Object} routes A map of pages '/posts/:_id' : { see Page ctor }
     * @return {PageRouter} Returns the PageRouter instance (self).
     */
    pages: function (routes) {
      var self = this;

      _.each(routes, function (config, path) {
        var page = new Page(self, path, config);
        self._pages[page.as] = page;
      });

      return self;
    },

    /**
     * Returns the current page.
     * @api public
     * @return {Page} An instance of the Page constructor.
     */
    page: function () {
      this._pageContexts.addCurrentContext();
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

    run: function (nextPage, context) {
      var self = this;

      if (self._page !== nextPage) {
        self._page = nextPage;
        
        if (self._pageHandle) self._pageHandle.stop();

        Meteor.autorun(function (handle) {
          self._pageHandle = handle;
          nextPage.run(context);
        });
      }
    }
  };

  var Page = function (router, path, options) {
    this.router = router;
    this.path = path;
    this.isPageCreated = false;

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
     * Proxy the route setup to the page handler, readying all the before
     * callbacks.
     * @api public
     * @param {String} templateName The name of the template to render.
     * @return {Page} Returns the Page instance.
     */
    to: function (templateName) {
      var pageHandler,
          setPage,
          self = this;

      if (this.isRouteCreated) {
        throw new Error('Page has already been created. You can only ' +
          'call the "to" method once.');
      }


      /* XXX Hack. Need to store a Route instance so we can do the path
       * helpers later
       */
      this.pageRoute = new page.Route(this.path);

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
     * @return {Page} Returns Page instance. 
     */
    as: function (name) {
      this.as = name;
      attachPathHelpers(name + 'Path', this);
      return this;
    },

    withNav: function (nav) {
      this.nav = nav;
    },

    withLayout: function (templateName) {
      if (!Template[templateName])
        throw new Error("Couln't find a layout template with name " + 
          templateName + ". Are you sure you defined one?");

      this.layoutTemplateName = templateName;
      return this;
    },

    before: function (callbacks) {
      this.beforeCallbacks = callbacks;
      return this;
    },

    pathWithContext: function (context) {
      var self = this;
      var pageRoute = self.pageRoute;
      var path = self.path;
      var parts = pageRoute.regexp.exec(pageRoute.path).slice(1);

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

    run: function (context) {

      var beforeCallbacks = this.beforeCallbacks;

      context = context || {};

      for (var i = 0; i < beforeCallbacks.length; i++) {
        if (context.stopped) return;
        else beforeCallbacks[i].call(this, context);
      }

      this.render();
    },

    render: function () {
      var self = this;

      var childFn = function () {
        var layoutFn,
            layoutName;

        layoutName = self.layoutTemplateName;

        layoutFn = Template[layoutName] ? Template[layoutName] :
          function (data) { return data["yeild"](); };

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
  _.extend(Meteor, {
    PageRouter  : PageRouter,
    pages       : _.bind(Meteor.router.pages, Meteor.router),
    page        : _.bind(Meteor.router.page, Meteor.router),
    go          : _.bind(Meteor.router.go, Meteor.router)
  });

  Meteor.startup(function () {
    page();
  });
}());
