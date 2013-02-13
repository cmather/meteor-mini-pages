if (Handlebars) {
  Meteor.PageRouter.onAttachPathHelper = function (helperName, fn) {
    if (Handlebars._default_helpers[helperName]) return;

    Handlebars.registerHelper(helperName, function (context, options) {
      if (arguments.length === 1)
        return fn(this);
      else
        return fn(context);
    });
  };

  Handlebars.registerHelper("renderPages", function (options) {
    return Meteor.router && new Handlebars.SafeString(Meteor.router.render());
  });

  Handlebars.registerHelper("pageTemplate", function (options) {
    return Meteor.router && Meteor.router.template();
  });

  Handlebars.registerHelper("pageTemplateEquals", function (value, options) {
    return Meteor.router && Meteor.router.templateEquals(value);
  });

  Handlebars.registerHelper("pageNav", function (options) {
    return Meteor.router && Meteor.router.nav();
  });

  Handlebars.registerHelper("pageNavEquals", function (value, options) {
    return Meteor.router && Meteor.router.navEquals(value);
  });

  Handlebars.registerHelper("pageLayout", function (options) {
    return Meteor.router && Meteor.router.layout();
  });

  Handlebars.registerHelper("pageLayoutEquals", function (value, options) {
    return Meteor.router && Meteor.router.layoutEquals(value);
  });

  Handlebars.registerHelper("pagePath", function (options) {
    return Meteor.router && Meteor.router.path();
  });

  Handlebars.registerHelper("page", function (options) {
    return Meteor.router && Meteor.router.invocation();
  });
}
