mini-pages
===============

mini-pages is a simple client side page routing library for Meteor.

Latest Version: **0.3.0**

Previous Version: 0.2.3

## Change Notes

* Before filters now set `this` to the PageInvocation. No parameters are passed to the filter. See the API docs for specifics or the Get Started section for a quick example.
* Before filters now have `this.set` and `this.get` methods to set variables for a specific page and automatically clear them on a new path.
* Layouts do not replace the entire body any more. mini-pages uses Spark to only re-render the layout or template if it has changed, even for new paths.
* Dynamically change layout, template, or nav in a before callback.
* Stop additional before callbacks from running using the `this.done()` method inside the callback.

## API Docs
### http://cmather.github.com/meteor-mini-pages/

## Install

To install in a new project:
```bash
> mrt add mini-pages
```

To update an existing project:
```bash
> mrt update mini-pages
```

## Run the Example
```bash
> git clone https://github.com/cmather/meteor-mini-pages.git mini-pages
> cd mini-pages/examples/basic
> mrt
```

## Run Tests
```bash
> git clone https://github.com/cmather/meteor-mini-pages.git mini-pages
> mrt
```

## Get Started

```javascript
if (Meteor.isClient) {
  Meteor.pages({

    // Page values can be an object of options, a function or a template name string

    '/': { to: 'postIndex', as: 'root', nav: 'posts' },
    '/posts': { to: 'postIndex', nav: 'posts' },
    '/posts/:_id': { to: 'postShow', before: [setPost] },
    '/secret': { to: 'secret', nav: 'secret', before: secret },
    '/logout': logout,
    '*': 'notFound'
  }, {

    // optional options to pass to the PageRouter

    defaults: {
      layout: 'layout'
    }
  });
}
```

## Before Callbacks

Before callbacks let you set page variables, and dynamically change the page's layout, nav key or template. Before callbacks are reactive. This means that if they rely on a reactive data source and that data changes, the callbacks will be run again.

```javascript
function loggingIn () {
  if (Meteor.isLoggingIn()) {
    // dynamically set the template
    this.template("loggingIn");
    
    // stop downstream callbacks from running
    this.done();
  }
}

function first () {
  // set page specific variables using the set method
  this.set("post", { _id: 1 });
}

function second () {
  // dynamically set layout and nav keys or redirect
  this.layout("somelayoutTemplateName");
  this.nav("someNavKey");

  // redirect to a different path
  this.redirect(Meteor.someOtherPath());
}

Meteor.pages({
  '/posts/:_id': { to: "postShow", before: [loggingIn, first, second] }
});
```

## Handlebars Helpers

* {{renderPages}}: Manually render the pages. Must be used in combination with the `autoRender: false` option to the router.
* {{pageTemplate}}: The current template name.
* {{pageTemplateEquals 'value'}}: True if the value is equal to the current template.
* {{pageNav}}: The current nav key.
* {{pageNavEquals 'value'}}: True if the value is equal to the current nav key.
* {{pageLayout}}: The current layout template name.
* {{pageLayoutEquals 'value'}}: True if the value is equal to the current layout template name.
* {{pagePath}}: The current path.
* {{page}}: The current page's invocation dictionary. Access variabes that were set in before callbacks using the `this.set("key", "value")` method.
