(function () {
  var config = Meteor.RouteMap.config;
  var currentNavKey = config.currentNavSessionKey;
  var currentPageSessionKey = config.currentPageSessionKey;

  if (Handlebars) {
    Handlebars.registerHelper('page', function (options) {
      return new Handlebars.SafeString(Meteor.router.render());
    });

    Handlebars.registerHelper('currentPage', function (options) {
      return Session.get(currentPageSessionKey);
    });

    Handlebars.registerHelper('currentPageIs', function (name, options) {
      return Session.equals(currentPageSessionKey, name);
    });

    Handlebars.registerHelper('currentNav', function (options) {
      return Session.get(currentNavKey);
    });

    Handlebars.registerHelper('currentNavIs', function (name, options) {
      return Session.equals(currentNavKey, name);
    });

    Meteor.RouteMap.onAttachYieldHelper = function (template, content) {
      template.helpers({
        "yield": function (options) {
          return new Handlebars.SafeString(content);
        }
      });
    }

    Meteor.RouteMap.onAttachPathHelper = function (pathName, route) {
      Handlebars.registerHelper(pathName, function (context, options) {
        if (arguments.length === 1) {
          /* no context parameter was passed to helper */
          return route.pathWithContext(this);
        } else {
          /* a contet parameter was passed */
          return route.pathWithContext(context);
        }
      });
    };
  }
}());
