mini-pages
===============

mini-pages is a simple client side page routing library for Meteor.

Latest Version: **0.3.1**

Previous Version: 0.3.0

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

## Quick Start

```html
<body>
  <!-- Nothing needed in body unless router autoRender is false and you manually use renderPages helper --->
</body>

<template name="layout">
  {{{yield}}}
</template>

<template name="postIndex">
</template>

<template name="postShow">
</template>

<template name="secret">
</template>

<template name="notFound">
</template>

```

## Defining Routes

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
  if (Meteor.loggingIn()) {
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
