if (Handlebars) {
  Handlebars.registerHelper("renderPage", function (options) {
    return Meteor.router && new Handlebars.SafeString(Meteor.router.render());
  });

  Handlebars.registerHelper("currentTemplate", function (options) {
    return Meteor.router && Meteor.router.template();
  });

  Handlebars.registerHelper("currentNav", function (options) {
    return Meteor.router && Meteor.router.nav();
  });

  Handlebars.registerHelper("currentLayout", function (options) {
    return Meteor.router && Meteor.router.layout();
  });

  Handlebars.registerHelper("currentPath", function (options) {
    return Meteor.router && Meteor.router.path();
  });
}
