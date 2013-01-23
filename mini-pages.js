(function () {

  // XXX: Hack. If a user ends up aborting a route in the middle and
  // redirecting, the original url sticks around because the page
  // library doesn't check whether the user stoped the route. Maybe
  // find a cleaner way or make a pull request to page-js.
  page.Context.prototype.save = function(){
    if (!this.stopped)
      history.replaceState(this.state, this.title, this.canonicalPath);
  };
  

  var RouteMap = function (options) {
    var self = this;
    self.contexts = new Meteor.deps._ContextSet;
    self.options = options || {};
  };

  RouteMap.config = {
    currentPageSessionKey: "currentPage",
    currentNavSessionKey: "currentNav"
  };

  RouteMap.prototype = {
    constructor: RouteMap,

    render: function () {
      var self = this,
          currentPageSessionKey = RouteMap.config.currentPageSessionKey,
          currentNavSessionKey = RouteMap.config.currentNavSessionKey, 
          childContent,
          data,
          route;

      /* This will add current context for reactivity */
      route = self.current();

      if (route) {
        /* might use this later */
        data = {};

        childContent = Template[route.templateName](data);

        if (currentPageSessionKey !== false && currentPageSessionKey && route.as) {
          Session.set(currentPageSessionKey, route.as);
        }

        if (currentNavSessionKey !== false && currentNavSessionKey && route.nav) {
          Session.set(currentNavSessionKey, route.nav);
        }

        if (route.layoutTemplateName) {
          var layoutTemplate = Template[route.layoutTemplateName];

          if(!layoutTemplate)
            throw new Error('layout template ' + route.template + ' not found');

          if (!RouteMap.onAttachYieldHelper) {
            throw new Error(
              'RouteMap.onAttachYieldHelper is undefined.'
            );
          }

          RouteMap.onAttachYieldHelper(layoutTemplate, childContent);

          return layoutTemplate(data);

        } else {
          return childContent;
        }
      } else {
        return "";
      }

    },

    configure: function (options) {
      options = options || {};
      _.extend(this.options, options);
    },

    go: function (path, state) {
      /**
       * Let page handle everything. If the path was registered
       * through the RouteMap, then the RouteMap.Route instance
       * will call the _set method on this RouteMap with the Route
       * passed as a parameter. That will trigger the context
       * invalidations
       */

      return page.show(path, state);
    },

    /**
     * Create one route at a time
     */
    match: function (path, options) {
      return this.createRoute(path, options);
    },

    /**
     * Create all routes at once
     */
    draw: function (routeMap) {
      var self = this;

      for (var path in routeMap) {
        self.createRoute(path, routeMap[path]);
      }

      return self;
    },

    /**
     * Simple Route instance factory
     *
     */
    createRoute: function (path, options) {
      return new RouteMap.Route(this, path, options);
    },

    /**
     * The current route. Reactive.
     *
     */
    current: function () {
      var self = this;
      self.contexts.addCurrentContext();
      return self._currentRoute;
    },

    /**
     * Do not call directly. Called by Route instances when
     * the page library triggers the route's pageHandler callback. This
     * method in turn invalidates our contexts and sets the current page
     */
    _set: function (route) {
      var self = this;

      if (route !== self._currentRoute) {
        self._currentRoute = route;
        self.contexts.invalidateAll();
      }
    }
  };


  RouteMap.Route = function (routeMap, path, options) {
    var self = this;
    var routeMap = self.routeMap = routeMap;

    if (! (routeMap instanceof RouteMap))
      throw new Error('first parameter must be a RouteMap');

    if (!(_.isString(path) || _.isRegExp(path)))
      throw new Error('path is a required parameter to RouteMap.Route');

    if (_.isString(options)) {
      options = { to: options };
    }
    else if (_.isObject(options)) {
      if (!options.to)
        throw new Error('No "to" was specified in options');
    }
    else {
      throw new Error(
        'Second parameter must be a template name or an options object'
      );
    }

    if (!Template[options.to]) {
      throw new Error(
        'No template found with name ' + options.to
      );
    }
    
    self.isRouteCreated = false;
    self.path = path;

    if (typeof options.layout === 'undefined') {
      if (Template.layout) {
        self.withLayout('layout');
      }
    } else if (options.layout) {
      self.withLayout(options.layout);
    }

    if (options.before) self.before(options.before);

    if (options.nav) self.withNav(options.nav);

    if (options.to) self.to(options.to);

    if (options.as) {
      self.as(options.as);
    } else if (options.to) {
      self.as(options.to);
    }
  };

  RouteMap.Route.prototype = {
    constructor: RouteMap.Route,

    to: function (templateName) {
      var self = this;

      if (self.isRouteCreated)
        throw new Error('Route has already been created');

      if (!_.isString(templateName))
        throw new Error('template name is required first parameter');

      self.templateName = templateName;
      self.pageRoute = new page.Route(self.path);

      var handlePage = (function (route) {
        return function (context, next) {
          if (!context.stopped) {
            route.routeMap._set(route); 
          }
        }
      })(self);

      var beforeHandlers = self.beforeHandlers || [];
      var handlers = beforeHandlers.concat(handlePage);
      page.apply(this, [self.path].concat(handlers));
      self.isRouteCreated = true;
      return self;
    },

    as: function (pathName) {
      var self = this;
      var pathHelper = pathName + 'Page';
      self.as = pathName;

      if (!RouteMap.onAttachPageHelper)
        throw new Error('onAttachPageHelper not found in helpers file');

      RouteMap.onAttachPageHelper(pathHelper, self);

      /* for use with Meteor.go(Meteor.pages.somePage({})) */
      if (!Meteor.pages[pathHelper]) {
        Meteor.pages[pathHelper] = function (context) {
          context = context || this;
          return self.pathWithContext(context);
        }
      }

      return self;
    },

    pathWithContext: function (context) {
      var self = this;
      var pageRoute = self.pageRoute;
      var path = self.path;
      var parts = pageRoute.regexp.exec(pageRoute.path).slice(1);

      if (!context) throw new Error('context is a required parameter');

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

    withNav: function (nav) {
      this.nav = nav;
    },

    withLayout: function (templateName) {
      var self = this;
      self.layoutTemplateName = templateName;
    },

    before: function (handlers) {
      var self = this;

      if (self.isRouteCreated) {
        throw new Error(
          'Route has already been created. Must call this method before the "to" method'
        );
      }

      handlers = handlers || [];
      handlers = _.isArray(handlers) ? handlers : [handlers];

      var wrapBeforeHandler = function (handler) {
        return function (context, next) {
          if (!_.isFunction(context.stop)) {
            _.extend(context, {
              stop: function () {
                this.stopped = true;
                this.unhandled = true;
              }
            });
          }

          handler(context);
         
          if (!context.stopped)
            next && next();
        };
      };

      self.beforeHandlers = _.map(handlers, wrapBeforeHandler);
      
      return self;
    }
  };

  Meteor.RouteMap = RouteMap;
  Meteor.router = new Meteor.RouteMap;
  Meteor.pages = _.bind(Meteor.router.draw, Meteor.router);
  Meteor.go = _.bind(Meteor.router.go, Meteor.router);

  Meteor.startup(function () {
    page();
  });

}());
