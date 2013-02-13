(function () {

  var pagejs = page;

  /* modify page-js to not push a route if the context is stopped */
  pagejs.Context.prototype.save = function () {
    if (!this.stopped)
      history.replaceState(this.state, this.title, this.canonicalPath);
  };

  /* Provide a stop() method in a page-js Context instance */
  pagejs.Context.prototype.stop = function () {
    this.stopped = true;
    this.unhandled = true;
  };

  var sessionLayoutKey = "mini-pages-router_layout";
  var sessionTemplateKey = "mini-pages-router_template";
  var sessionNavKey = "mini-pages-router_nav";
  var sessionInvocationKey = "mini-pages-router_invocation";

  /* Hook to attach path helpers to Handlebars or any other registered
   * template engine. Look in lib/helpers.js for example.
   */
  function attachPathHelpers (helperName, page) {
    if (!PageRouter.onAttachPathHelper)
      throw new Error('Your template engine might not be supported in the ' +
                      'mini-pages package. Could not find PageRouter.' +
                      'onAttachPathHelper which is normally defined in ' +
                      'the mini-pages/lib/helpers.js file');
    
    if (!Meteor[helperName]) {
      var helper = function (context) {
        return page.pathWithContext(context);
      }

      Meteor[helperName] = helper;
      PageRouter.onAttachPathHelper(helperName, helper);
    }
  }

  /* Throws an error if it can't find the template in Template */
  function getTemplate (name) {
    if (!Template[name])
      throw new Error(
        "Couldn't find template named " + name + ". Are you sure you defined it?"
      );

    return Template[name];
  }

  /* Strong check if original is undefined use a defualt value */
  function defaultValue (original, defaultValue) {
    return typeof original === 'undefined' ? defaultValue : original;
  }

  /* Coerces value into an array even if the value is already an array,
   * is falsy or an object
   */
  function arrayFrom (value) {
    if (_.isArray(value))
      return value;
    else if (typeof value === 'undefined')
      return [];
    else
      return [value];
  }

  /* Coerce a and b into arrays, concat b onto a and return the result */
  function concatValuesIntoArray (a, b) {
    return arrayFrom(a).concat(arrayFrom(b));
  }

  /* display a console warning if we can */
  function warn () {
    if (console && console.warn) {
      var msg = _.toArray(arguments).join("");
      console.warn("mini-pages: ", msg);
    }
  }

  /* if template not defined in Template show a warning */
  function warnIfTemplateNotFound (name) {
    if (name === false || _.isUndefined(name))
      return;
    else if (!Template[name])
      warn("A template named '", String(name), "' hasn't been defined yet.");
  }

  /**
    The main mini-pages class. Manages creating pages, rendering and 
    responding to url path changes. You can only create one PageRouter instance.
    
    @class PageRouter
    @constructor
    @param {Object} [options] PageRouter options
     @param {Boolean} [options.autoRender] Set `false` to render manually 
     (i.e. when you use the {{renderPages}} Handlebars helper
     @param {Boolean} [options.autoStart] Set to `false` to manually decide 
     when to listen for url change events.
     @param {Object} [options.defaults] Default options that will be applied to
     all {{#crossLink "PageRouter.Page"}}{{/crossLink}} instances.
  */ 
  var PageRouter = function (options) {
    
    if (Meteor.router)
      throw new Error("Only one instance of PageRouter is allowed.");

    if (!(this instanceof PageRouter))
      return new PageRouter(options);

    Meteor.router = this;

    options = _.extend({
      autoRender: true,
      autoStart: true,
      defaults: {
        layout: "layout"
      }
    }, options || {});

    this._currentPath = null;
    this.defaults = options.defaults;

    if (options.autoStart) this.autoStart();
    if (options.autoRender) this.autoRender();
  };

  PageRouter.prototype = {
    constructor: PageRouter,

    /**
      Create a bunch of pages at once.

      @example
          var router = new Meteor.PageRouter({});
          router.pages({
           "/posts/:_id": {
              to: "templateName",
              layout: "layoutName",
              nav: "nav key",
              before: [ before callbacks ],
              as: "path helpers name"
           }
          });

       @method pages
       @chainable
       @param {Object} pages An object of page definitions where the key is a
       url path and the values are options to the 
       {{#crossLink "PageRouter.Page"}}{{/crossLink}} constructor.
    */
    pages: function (pages) {
      var self = this;
      _.each(pages, function (options, path) {
        self.match(path, options);
      });
      return self;
    },

    /**
      Create a new {{#crossLink "PageRouter.Page"}}{{/crossLink}}
      and return it.

      @example
          // with options
          var router = new Meteor.PageRouter({});
          router.match("/posts/:_id", { to: "templateName" };

          // no options
          var router = new Meteor.PageRouter({});
          router.match("/posts/:_id").to("templateName");

      @method match
      @param {String} path The path to match.
      @param {Object} [options] Options to pass to the 
        {{#crossLink "PageRouter.Page"}}{{/crossLink}} constructor.
      @return {PageRouter.Page}
        A {{#crossLink "PageRouter.Page"}}{{/crossLink}} instance.
    */
    match: function (path, options) {
      return new PageRouter.Page(this, path, options);
    },

    /**
      Navigate to a given path.

      @method go
      @chainable
      @example
          var router = new Meteor.PageRouter({});
          router.go("/posts/1234", { someState: "" });

      @param path {String} The path to navigate to.
      @param [state] {Object} A state object to pass along.
    */
    go: function (path, state) {
      pagejs(path, state);
      return this;
    },

    /**
      Automatically start the router by adding a callback to Meteor.startup.
      The router is auto started by default.

      @method autoStart
      @chainable
    */
    autoStart: function () {
      var self = this;
      Meteor.setTimeout(function () {
        Meteor.startup(_.bind(self.start, self));
      });
      return self;
    },

    /**
      Start listening for pushState events from the browser and responding
      to url changes. Call this to manually start listening. If you call
      autoStart() this will automatically be called from within a Meteor.startup
      callback. You usually shouldn't need to call this method.

      @method start
      @chainable
    */
    start: function () {
      if (!this._started) {
        pagejs();
        this._started = true;
      }
      return this;
    },

    /**
      Returns true of the start() method has been called

      @method isStarted
      @return {Boolean} True if the start() method has been called
    */
    isStarted: function () {
      return !!this._started;
    },

    /**
      Automatically render the router to the document.body. By default the
      router will use autoRender(). If you instead want to render the router's
      pages in a particular part of the DOM you can call render() instead and
      attach the document fragment manually. For example, the Handlebars helper
      {{renderPages}} does this.

      @method autoRender
    */
    autoRender: function () {
      var self = this;
      Meteor.startup(function () {
        var renderRouter = _.bind(self.render, self),
            frag;

        frag = Meteor.render(renderRouter);
        document.body.appendChild(frag);
      });
    },

    /**
      Creates two isolated regions. One for the layout and one for the template.
      Uses Spark's native reactivity to re-render the layout or template if 
      the router's current layout or template changes.

      @method render
      @return {DocumentFragment | String} If called from within Meteor.render
      it returns a DocumentFragment, otherwise a string of html.
    */
    render: function () {
      var router = this,
          page;

      page = function () {
        var layout, 
            layoutName = router.layout();

        if (_.isString(layoutName))
          layout = getTemplate(layoutName);
        else
          layout = function (data) { return data["yield"](); };

        return layout({
          "yield": function () {
            return Spark.isolate(function () {
              var templateName = router.template(),
                  template;

              template = templateName ? getTemplate(templateName) :
                function () { return ""; };

              return Spark.isolate(template);
            });
          }
        });
      };

      router._isRendered = true;
      return Spark.isolate(page);
    },

    /**
      Returns true of the render() method has been called at least once. Does
      not mean that anything has been attached to the dom.

      @method isRendered
      @return {Boolean} True of the render() method has been called.
    */
    isRendered: function () {
      return !!this._isRendered;
    },

    /**
      If the path is different from the current path, creates a new
      {{#crossLink "PageRouter.PageInvocation"}}{{/crossLink}} and runs
      the page with the new invocation.

      @method run
      @chainable
      @param path {String} The url path.
      @param page {PageRouter.Page} A page instance.
      @param [context] {Object} An optional context object.
    */
    run: function (path, page, context) {
      if (path !== this._currentPath) {
        this._currentPath = path;
        this._currentPage = page;
        this._runWithInvocation(page, context);
      }
      return this;
    },

    /**
      Creates a new {{#crossLink "PageRouter.PageInvocation"}}{{/crossLink}}
      and runs the page. Then set's the router's layout, template, nav and
      invocation object (the object you get when you call {{page.someprop}} in
      your html.

      @method _runWithInvocation
      @private
      @param page {PageRouter.Page} The page instance.
      @param [context] {Object} An optional context object.
    */
    _runWithInvocation: function (page, context) {
      var self = this;

      if (self._invocationHandle)
        self._invocationHandle.stop();

      self._invocationHandle = Meteor.autorun(function () {
        var invocation = new PageRouter.PageInvocation(self, page, context);
        page.run(invocation);

        if (invocation.isStopped())
          return;
        else {
          self.layout(invocation.layout());
          self.template(invocation.template());
          self.nav(invocation.nav());
          self.invocation(invocation.toObject());
        }
      });
    },

    reset: function () {
      this._currentPath = null;
      this.layout(null);
      this.template(null);
      this.nav(null);
      this.invocation(null);
      return this;
    },

    /**
      Get or set the current invocation object. This is the object that is
      available in your template html by using the page handlebars helper like
      this: {{page.someProperty}}. The object gets its values from a before
      filter calling `this.set("key", "value")`. The value is stored in Session
      so that it's reactive and survives hot code pushes.

      @method invocation
      @param [value] {Object} If an object is passed it will be set, otherwise
        the current value will be returned.
      @return {Object} Returns the current invocation object if no parameter is
        passed.
    */
    invocation: function (value) {
      if (typeof value !== 'undefined')
        Session.set(sessionInvocationKey, value);
      else
        return Session.get(sessionInvocationKey);
    },

    /**
      Reactively get or set the current layout.

      @method layout
      @param [value] {String} The name of the layout template.
      @return {String} If no value passed, return the current layout template
        name.
    */
    layout: function (value) {
      if (typeof value !== 'undefined')
        Session.set(sessionLayoutKey, value);
      else
        return Session.get(sessionLayoutKey);
    },

    /**
      Reactively test the current layout name for equality with the passed
      value.

      @method layoutEquals
      @param value {String} The name of the layout template to test quality.
      @return {Boolean} Returns true if the template names are equal.
    */
    layoutEquals: function (value) {
      return Session.equals(sessionLayoutKey, value);
    },

    /**
      Reactively get or set the current template.

      @method template
      @param value {String} The name of the template.
      @returns {String} If no value passed returns the name of the current template.
    */
    template: function (value) {
      if (typeof value !== 'undefined')
        Session.set(sessionTemplateKey, value);
      else
        return Session.get(sessionTemplateKey);
    },

    /**
      Reactively test the current template name for equality with the passed
      value.

      @method templateEquals
      @param value {String} The name of the template to test quality.
      @return {Boolean} Returns true if the template names are equal.
    */
    templateEquals: function (value) {
      return Session.equals(sessionTemplateKey, value);
    },

    /**
      Reactively get or set the current nav key.

      @method nav
      @param value {String} The value of the nav key.
      @returns {String} If no value passed returns the current nav key.
    */
    nav: function (value) {
      if (typeof value !== 'undefined')
        Session.set(sessionNavKey, value);
      else
        return Session.get(sessionNavKey);
    },

    /**
      Reactively test the current nav key for equality with the passed
      value.

      @method navEquals
      @param value {String} The nav key to test for equality.
      @return {Boolean} Returns true if the nav keys are equal.
    */
    navEquals: function (value) {
      return Session.equals(sessionNavKey, value);
    },

    /**
      Returns the router's current url path.

      @method path
      @return {String} The current url path.
    */
    path: function () {
      return this._currentPath;
    }
  };

  /**
    Controller and container class for a page route. The constructor function
    registers the page with the underlying pushState handler. For now, we are
    using page-js to do this. You shouldn't create Page instances directly.
    Instead, let the PageRouter manage this for you.
    @example
        new PageRouter.Page(router, "/posts/:_id", {
            to: "templateName",
            as: "pathHelper",
            layout: "layoutTemplateName",
            nav: "navKey",
            before: [firstFilter, secondFilter]
        });
  
    @class PageRouter.Page
    @constructor

    @param router {PageRouter} A PageRouter instance.
    @param path {String} The path associated with the page.
    @param [options] {Object | String | Function} Can either be an object
    of options, the name of a template, or a function that will act as the
    last before filter.
      @param [options.to] {String} The name of a template to render.
      @param [options.as] {String} The name used in path helpers. All names
      will get a path helper like this: <name>Path. These path helpers are
      available as methods like Meteor.postShowPath() and as Handlebars helpers.
      @param [options.layout] {String} The name of a template to use for a layout.
      @param [options.nav] {String} A key to use for nav. Most useful in applying
      conditional classes to navigation bars.
      @param [options.before] {Function | Array} A function or array of functions
      to be called before the layout and template are rendered.
  */ 
  PageRouter.Page = function (router, path, options) {
    var self = this;

    self.router = router;
    self.path = path;
    self._beforeCallbacks = [];

    options = options || {};

    if (_.isFunction(options)) {
      options = { before: options };
    }
    else if (_.isString(options)) {
      options = { to: options };
    }

    self.before(concatValuesIntoArray(router.defaults.before, options.before));
    self.nav(options.nav || router.defaults.nav);
    self.to(options.to || router.defaults.to);
    self.layout(options.layout || router.defaults.layout);

    /* default to the template name for path helpers */
    self.as( options.as ? options.as : options.to );

    // XXX page dependency hack. should be removed.
    self._route = new page.Route(self.path);

    self._register();
  };

  PageRouter.Page.prototype = {
    constructor: PageRouter.Page,

    /**
      Registers the page with the underlying pushState handler. We're using
      page-js.

      @method _register
      @private
    */
    _register: function () {
      var self = this;

      var onPageRoute = function (context, next) {
        self.router.run(context.path, self, context);
      };

      pagejs(self.path, onPageRoute);

      return self;
    },

    /**
      Set a default template name for the page.

      @method to
      @chainable
      @param template {String} The name of a template.
    */
    to: function (template) {
      warnIfTemplateNotFound(template);
      this.defaultTemplate = template;
      return this;
    },

    /**
      Set the name of the page. Primarily used in path helpers.

      @method as
      @chainable
      @param name {String} The name of the page, and of the path helper prefix.

      @example
          page.as("postShow");
          // results in a path helper attached to Meteor and available
          // in Handlebars.
          // {{postShowPath}}
          // Meteor.postShowPath({});

    */
    as: function (name) {
      if (name) {
        this.name = name;
        attachPathHelpers(name + 'Path', this);
      }
      return this;
    },

    /**
      Set the default nav key for this page.
      
      @method nav
      @chainable
      @param nav {String} The name of the default nav key to use for this page.

      @example
          page.nav("posts"); // sets the nav key primarily used for nav bars.
    */
    nav: function (nav) {
      this.defaultNav = nav;
      return this;
    },

    /**
      Set the default layout for this page.

      @method layout
      @chainable
      @param layout {String} The name of the template to use as a layout.

      @example
          page.layout("layoutTemplateName");
    */
    layout: function (layout) {
      warnIfTemplateNotFound(layout);
      this.defaultLayout = layout;
      return this;
    },

    /**
      A function or array of functions to call before rendering the page. The
      before callbacks will be called with `this` set to a
      {{#crossLink PageRouter.PageInvocation}}{{/crossLink}} instance.

      @method before
      @chainable
      @param callbacks {Function | Array} A function or array of callbacks.
    */
    before: function (callbacks) {
      callbacks = _.isArray(callbacks) ? callbacks : [callbacks];
      this._beforeCallbacks = this._beforeCallbacks.concat(callbacks);
      return this;
    },

    /**
      Given a context object, returns a url path with the values of the context
      object mapped over the path. This method is attached to a Handlebars
      helper and to Meteor to call from JavaScript directly. For example, given
      a page named "postShow" you will get a Handlebars helper {{postShowPath}}
      and Meteor.postShowPath({});

      @method pathWithContext
      @param [context] {Object} An optional context object to use for
      interpolation.

      @example
          // given a page with a path of "/posts/:_id/edit"
          var path = page.pathWithContext({ _id: 123 });
          // > /posts/123/edit
    */
    pathWithContext: function (context) {
      var self = this,
          route = self._route,
          path = self.path,
          parts;
          
      /* get an array of keys from the path to replace with context values.
      /* XXX Right now this comes from page-js. Remove dependency. 
       */
      parts = route.regexp.exec(route.path).slice(1);

      context = context || {};

      var replacePathPartWithContextValue = function (part) {
        var re = new RegExp(part, "g"),
            prop = part.replace(":", ""),
            val;

        if (val = context[prop])
          path = path.replace(re, val);
        else
          path = path.replace(re, "");
      };

      _.each(parts, replacePathPartWithContextValue);

      return path;
    },

    /**
      Run the page with a PageRouter.PageInvocation. Runs the page's before
      callbacks and set's the invocation's default layout, template and nav.
      Returns the resulting mutated invocation.
    */
    run: function (invocation) {
      var invocation,
          callbacks = this._beforeCallbacks,
          template,
          nav,
          layout;


      for (var i = 0; i < callbacks.length; i++) {
        if (invocation.isDone()) break;
        // XXX Pass invocation as first parameter for now so last version
        // doesn't break miserably for people. Remove eventually.
        callbacks[i].call(invocation, invocation);
      }

      invocation.layout(defaultValue(invocation.layout(), this.defaultLayout || null));
      invocation.template(
        defaultValue(invocation.template(), this.defaultTemplate || null)
      );
      invocation.nav(defaultValue(invocation.nav(), this.defaultNav || null));

      return invocation;
    }
  };

  /**
    Created each time the url path changes and a page is run. The PageInvocation
    allows before filters to dynamically set the template, layout and nav, and
    provides methods for redirecting, stopping execution of the before filters and
    getting and setting page variables that will be cleaned up when a new page
    is run.

    Instances are created automatically by the PageRouter when a path change
    causes the router's run method to be called. The PageInvocation instance
    is the value of `this` in all before filters.

    @class PageRouter.PageInvocation
    @constructor
    @param router {PageRouter} A page router instance.
    @param page {PageRouter.Page} A page instance.
    @param [context] {Object} An optional context object.
  */

  PageRouter.PageInvocation = function (router, page, context) {
    if (_.isUndefined(context))
      throw new Error(
        "PageInvocation requires a context object with a stop() method and a params attribute"
      );

    this.context = context;
    this.params = context.params || {};
    this._router = router;
    this.page = page;
    this._stopped = false;
    this._done = false;
    this._dictionary = {};
  };

  PageRouter.PageInvocation.prototype = {
    constructor: PageRouter.PageInvocation,

    /**
      The context object from the page-js event.

      @attribute context
      @type {Object}
    */
    context: null,

    /**
      The params from the url path.

      @attribute params
      @type {Object}
    */
    params: null,

    /**
      The invocation's PageRouter.Page instance.

      @attribute page
      @type {PageRouter.Page}
    */
    page: null,

    /**
      Gets or sets the invocation's layout template name.

      @method layout
      @param [value] {String} An optional layout template name.
      @returns {String} If no value provided, returns the invocation's layout
      template name.
    */
    layout: function (value) {
      if (typeof value !== 'undefined')
        this._layout = value;
      else
        return this._layout;
    },

    /**
      Gets or sets the invocation's template name.

      @method template
      @param [value] {String} An optional template name.
      @returns {String} If no value provided, returns the invocation's
      template name.
    */
    template: function (value) {
      if (typeof value !== 'undefined')
        this._template = value;
      else
        return this._template;
    },

    /**
      Gets or sets the invocation's nav key.

      @method template
      @param [value] {String} An optional nav key.
      @returns {String} If no value provided, returns the invocation's
      nav key.
    */
    nav: function (value) {
      if (typeof value !== 'undefined')
        this._nav = value;
      else
        return this._nav;
    },

    /**
      Stops the current page and redirects to a new path.

      @method redirect
      @param path {String} The path to redirect to.
      @param [state] {Object} An optional state object to pass along.
      @example
          // before filter
          function filter () {
            this.redirect(Meteor.postIndexPath());
          }
    */
    redirect: function (path, state) {
      this.stop();
      this._router.go(path, state);
    },

    /**
      Stops the current page run. Also stops pushState from being called. Call
      this to completely stop. No rendering, no more filters.

      @method stop
    */
    stop: function () {
      this._stopped = true;
      this.context.stop();
      this.done();
    },

    /**
      Returns true if the invocation has been stopped.

      @method isStopped
      @returns {Boolean} True if the stop() method has been called.
    */
    isStopped: function () {
      return !!this._stopped;
    },

    /**
      Don't run any additional before filters.

      @method done
      @example
          // inside a before filter
          function filter () {
            if (Meteor.loggingIn()) {
              this.template("loggingIn");
              this.done();
            }
          }
    */
    done: function () {
      this._done = true;
    },

    /**
      Returns true if the invocation has been marked as done.

      @method isDone
      @returns {Boolean} True if the done() method has been called.
    */
    isDone: function () {
      return !!this._done;
    },

    /**
      Set a page variable that can be accessed for the current invocation from
      handlebars or downstream before filters. These will be cleared when a new
      page is run (i.e. the url path changes). These values are accessible
      using the `page` Handlebars helper.

      @method set
      @param key {String} The key. Example: "post".
      @param value {Any} Any value.
      @example
          // inside before filter
          function filter () {
            this.set("post", { _id: 1234 });
          }
    */
    set: function (key, value) {
      this._dictionary[key] = value;
    },

    /**
      Gets a current invocation value.

      @method get
      @param key {String} The key.
      @returns {Any} The value associated with the key.
      @example
          // inside before filter
          function filter () {
            var post = this.get("post");
          }
    */
    get: function (key) {
      return this._dictionary[key];
    },

    /**
      Returns the invocation's dictionary. This is what is put into Session
      before the page is rendered.

      @method toObject
      @returns {Object} The invocation's dictionary.
    */
    toObject: function () {
      return this._dictionary;
    }
  };

  /**
    The main Meteor API methods.
    
    @class MeteorExtensions
    @extensionfor Meteor
  */
  var MeteorExtensions = {
    /**
      Convenience method to create a new PageRouter instance and call the
      pages method on it to create a bunch of pages at once.

      @example
          Meteor.pages({
           "/posts": "postIndex",

           "/posts/:_id": {
              to: "templateName",
              layout: "layoutName",
              nav: "nav key",
              before: [ before callbacks ],
              as: "path helpers name"
           },

           logout: function () {
           }
          }, {
            // optional options to pass to PageRouter constructor.
            autoRender: false
          });


      @method Meteor.pages
      @param pages {Object} An object of paths to page options.
      @param [options] {Object} Optional options to pass to the PageRouter
      constructor
      @return {PageRouter} A new PageRouter instance.
    */
    pages: function (pages, options) {
      return new PageRouter(options).pages(pages);
    },

    /**
      The {{#crossLink "PageRouter"}}{{/crossLink}} class.

      @attribute Meteor.PageRouter
    */
    PageRouter: PageRouter,

    /**
      Navigate to the given path with an optional state object to pass along.
      This method proxies to the underlying pushState handler. We're currently
      using page-js.

      @example
          Meteor.go(Meteor.postShowPath({_id: 1234}), { flash: "" });

      @method Meteor.go
      @param path {String} The path to navigate to. Example: "/posts/1234".
      @param [state] {Object} An optional state object.
    */
    go: function (path, state) {
      pagejs(path, state);
    }
  };

  _.extend(Meteor, MeteorExtensions);

}());
