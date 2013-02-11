(function () {

  var sessionLayoutKey = "mini-pages-router_layout";
  var sessionTemplateKey = "mini-pages-router_template";
  var sessionNavKey = "mini-pages-router_nav";

  function getTemplate (name) {
    if (!Template[name])
      throw new Error(
        "Couldn't find template named " + name + ". Are you sure you defined it?"
      );

    return Template[name];
  }

  function defaultValue (original, value) {
    return typeof original === 'undefined' ? value : original;
  }

  /**
    The main mini-pages class. Manages creating pages, rendering and 
    responding to url path changes. You can only create one PageRouter instance.
    
    @class PageRouter
    @constructor
    @optional
    @param {Object} [options] PageRouter options
     @param {Boolean} [options.autoRender] Set `false` to render manually 
     (i.e. when you use the {{renderPage}} Handlebars helper
     @param {Boolean} [options.autoStart] Set to `false` to manually decide 
     when to listen for url change events.
  */ 
  var PageRouter = function (options) {
    
    if (Meteor.router)
      throw new Error("Only one instance of PageRouter is allowed.");

    if (!(this instanceof PageRouter))
      return new PageRouter(options);

    Meteor.router = this;

    options = _.extend({
      autoRender: true,
      autoStart: true
    }, options);

    this._currentPath = null;

    if (options.autoStart) this.autoStart();
    if (options.autoRender) this.autoRender();
  };

  PageRouter.prototype = {
    constructor: PageRouter,

    /**
      Map url paths to pages.

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

    match: function (path, options) {
      return new PageRouter.Page(this, path, options);
    },

    go: function (path, state) {
      page(path, state);
    },

    autoStart: function () {
      Meteor.startup(_.bind(this.start, this));
    },

    start: function () {
      page();
    },

    autoRender: function () {
      var self = this;
      Meteor.startup(function () {
        var renderRouter = _.bind(self.render, self),
            frag;

        frag = Meteor.render(renderRouter);
        document.body.appendChild(frag);
      });
    },

    render: function () {
      var router = this,
          page;

      page = function () {
        var layout, 
            layoutName = router.layout();

        if (_.isUndefined(layoutName) && Template["layout"])
          layout = Template["layout"];
        else if (_.isString(layoutName))
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

      return Spark.isolate(page);
    },

    run: function (path, page, context) {
      if (path !== this._currentPath)
        this._runWithInvocation(page, context);
    },

    _runWithInvocation: function (page, context) {
      var self = this;

      if (self._invocationHandle)
        self._invocationHandle.stop();

      self._invocationHandle = Meteor.autorun(function () {
        var invocation = page.run(context);

        if (invocation.stopped)
          return;
        else {
          self.layout(invocation.layout());
          self.template(invocation.template());
          self.nav(invocation.nav());
        }
      });
    },

    layout: function (value) {
      if (typeof value !== 'undefined')
        Session.set(sessionLayoutKey, value);
      else
        return Session.get(sessionLayoutKey);
    },

    template: function (value) {
      if (typeof value !== 'undefined')
        Session.set(sessionTemplateKey, value);
      else
        return Session.get(sessionTemplateKey);
    },

    nav: function (value) {
      if (typeof value !== 'undefined')
        Session.set(sessionNavKey, value);
      else
        return Session.get(sessionNavKey);
    },

    path: function () {
      return this._currentPath;
    }
  };

  /**
    Stores information about a specific route.
  
    @class PageRouter.Page
    @constructor
    @protected
  */ 
  PageRouter.Page = function (router, path, options) {
    var self = this;

    self.router = router;
    self.path = path;
    self._beforeCallbacks = [];

    if (_.isFunction(options)) {
      options = { before: options };
    }
    else if (_.isString(options)) {
      options = { to: options };
    }

    if (!_.isUndefined(options.before)) self.before(options.before);
    if (!_.isUndefined(options.nav)) self.nav(options.nav);
    if (!_.isUndefined(options.to)) self.to(options.to);
    if (!_.isUndefined(options.layout)) self.layout(options.layout);

    var onPageRoute = function (context, next) {
      self.router.run(context.path, self, context);
    };

    page(path, onPageRoute);
  };

  PageRouter.Page.prototype = {
    constructor: PageRouter.Page,

    to: function (template) {
      this.defaultTemplate = template;
      return this;
    },

    nav: function (nav) {
      this.defaultNav = nav;
      return this;
    },

    layout: function (layout) {
      this.defaultLayout = layout;
      return this;
    },

    before: function (callbacks) {
      callbacks = _.isArray(callbacks) ? callbacks : [callbacks];
      this._beforeCallbacks = this._beforeCallbacks.concat(callbacks);
      return this;
    },

    run: function (context) {
      var invocation,
          callbacks = this._beforeCallbacks,
          template,
          nav,
          layout;

      invocation = new PageInvocation(this.router, this, context);

      for (var i = 0; i < callbacks.length; i++) {
        if (invocation.stopped) break;
        callbacks[i].call(invocation);
      }

      invocation.layout(defaultValue(invocation.layout(), this.defaultLayout));
      invocation.template(
        defaultValue(invocation.template(), this.defaultTemplate)
      );
      invocation.nav(defaultValue(invocation.nav(), this.defaultNav));

      return invocation;
    }
  };

  var PageInvocation = function (router, page, context) {
    this.context = context;
    this.params = context.params || {};
    this.router = router;
    this.page = page;
    this.stopped = false;
  };

  PageInvocation.prototype = {
    constructor: PageInvocation,

    layout: function (value) {
      if (typeof value !== 'undefined')
        this._layout = value;
      else
        return this._layout;
    },

    template: function (value) {
      if (typeof value !== 'undefined')
        this._template = value;
      else
        return this._template;
    },

    nav: function (value) {
      if (typeof value !== 'undefined')
        this._nav = value;
      else
        return this._nav;
    },

    redirect: function (path, options) {
      this.stop();
      this._router.go(path, options);
    },

    stop: function () {
      this.stopped = true;
      this.context.stop();
    }
  };

  _.extend(Meteor, {
    pages: function (pages) {
      return new PageRouter().pages(pages);
    },

    PageRouter: PageRouter,

    go: function (path, state) {
      page(path, state);
    }
  });
}());
