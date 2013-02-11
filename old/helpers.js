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

  Handlebars.registerHelper("page", function (options) {
    return Session.get("page");
  });

  Handlebars.registerHelper("pageIs", function (name, options) {
    return Session.equals("page", name);
  });

  Handlebars.registerHelper("nav", function (options) {
    return Session.get("nav");
  });

  Handlebars.registerHelper("navIs", function (name, options) {
    return Session.equals("nav", name);
  });
}
