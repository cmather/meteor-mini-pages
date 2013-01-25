mini-pages
===============

mini-pages is a simple client side page routing library for Meteor. It was
heavily inspired by the Meteor.Router project:
https://github.com/tmeasday/meteor-router.

Latest version: 0.2.3

##Notes

A lot has changed from the previous release so take a quick look at the new
docs. Contributions are also very welcome!

##Installation

```bash
> mrt add mini-pages
```

##Quick Start

```html
<head>
</head>

<body>
</body>

<template name="layout">
  <h1>Layout</h1>

  <!-- yield the child template. don't forget the triple handles -->
  {{{yield}}}
</template>

<template name="postIndex">
  <h1>Post Index</h1>
</template>
```

```javascript
if (Meteor.isClient) {
  Meteor.pages({
    '/'             : { to: 'postIndex', as: 'root', nav: 'posts' },
    '/posts'        : { to: 'postIndex', as: 'postIndex', nav: 'posts' },
    '/post/:_id'    : { to: 'postShow', nav: 'posts', before: [setPost] },
    '/secret'       : { to: 'secret', before: authorize },
    '*'             : '404'
  });

  function setPost (context, page) {
    // get params through the context object
    var _id = context.params._id;
    Session.set("post", Posts.findOne(_id));
  }

  function authorize (context, page) {
    if (!Session.get("authorized")) {
      // use the redirect method of the context to redirect before
      // rendering the page

      context.redirect( Meteor.loginPath() );
    }
  }
}
```

##Handlebars Helpers

* `{{page}}`: The name of the current page (e.g. 'postShow')
* `{{nav}}`: The nav value stored with the current page (e.g. 'posts')
* `{{pageIs '<string>'}}`: Returns true if the current page's name is equal
* `{{navIs '<string>'}}`: Returns true if the current page's nav is equal

##Path Helpers

Each page will automatically get a path helper available in Handlebars and as a
method off of the `Meteor` namespace. The path helper will be the name of the
template followed by **Path**. The name of the page is what's specified in
the `as` property, or the name of the template by default (as specified by the
`to` property or the string value of the route).

###Path Helper Handlebars Example

```html
<template name="postRow">
  <tr>
    <td>
      <!-- the context will be 'this' by default -->
      <a href="{{showPostPath}}">Show with Implicit Context</a>
    </td>
    <td>
      <!-- or you can provide a context object as a parameter -->
      <a href="{{showPostPath this}}">Show with Explicit Context</a>
    </td>
  </tr>
</template>
```

###Path Helper Function Example

```javascript
function someFn () {
  var obj = { _id: "1234" };
  var path = Meteor.postShowPath(obj);
  // => /posts/1234
}
```

##Before Callbacks
Any `before` callbacks specified for a page are run in order, before the page is
rendered. These functions are reactive. So the entire page is rerun
automatically if before filter dependencies change (as long as the page is still
rendered).

These callbacks take two parameters:

1. `context`: Allows you to call `stop()` or `redirect("somepath")`. You can
   also update the pushState object by adding properties to `context.state` or
   add arbitrary properties that will be available to downstream callbacks.

2. `page`: The current page. This allows you to do some interesting things
   before the page is rendered. For example, you could change the layout
   template of the page dynamically based on whether the user is logged in.

**Example 1: Redirect the user**

```javascript
function authorize (context, page) {
  if (!Meteor.user())
    context.redirect( Meteor.loginPath() );
  }
}
```

**Example 2: Dynamic layout**

```javascript
function setLayout (context, page) {
  if (Meteor.user())
    page.withLayout('loggedinLayout');
  else
    page.withLayout('loggedoutLayout');
}
```

##Other Methods

1. `Meteor.page()`: Gets the current Page instance.
2. `Meteor.go("/posts", {someState: "bar"})`: Go to the given path with an
   optional state object that will get added to the pushState state object.
3. `Meteor.pages({})`: Define multiple page routes at once.
4. `Meteor.router`: The PageRouter instance.
5. `Meteor.PageRouter`: The PageRouter constructor function. You shouldn't need
   to touch this directly unless you're adding support for a different template
   engine.
