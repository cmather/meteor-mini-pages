// (function () {
//   var config = Meteor.RouteMap.config;
//   var currentNavKey = config.currentNavSessionKey;
//   var currentPageSessionKey = config.currentPageSessionKey;

//   if (Handlebars) {
//     Handlebars.registerHelper('currentPage', function (options) {
//       return Session.get(currentPageSessionKey);
//     });

//     Handlebars.registerHelper('currentPageIs', function (name, options) {
//       return Session.equals(currentPageSessionKey, name);
//     });

//     Handlebars.registerHelper('currentNav', function (options) {
//       return Session.get(currentNavKey);
//     });

//     Handlebars.registerHelper('currentNavIs', function (name, options) {
//       return Session.equals(currentNavKey, name);
//     });

//     Meteor.RouteMap.onAttachPageHelper = function (pageName, route) {
//       if (Handlebars._default_helpers[pageName]) return;

//       Handlebars.registerHelper(pageName, function (context, options) {
//         if (arguments.length === 1) {
//           /* no context parameter was passed to helper */
//           return route.pathWithContext(this);
//         } else {
//           /* a contet parameter was passed */
//           return route.pathWithContext(context);
//         }
//       });
//     };
//   }
// }());

if (Handlebars) {
  Meteor.PageRouter.onAttachPathHelper = function (helperName, fn) {
    if (Handlebars._default_helpers[helperName]) return;

    Handlebars.registerHelper(helperName, function (context, options) {
      if (arguments.length === 1)
        return fn(this);
      else
        return fn(context);
    });
  }
}
