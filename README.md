mini-pages
============

##Installation

```bash
> mrt add mini-pages
```

##Usage

This package provides simple routing and navigation for your Meteor app. You can
check out a full example in the examples directory. It was inspired heavily by the Meteor.Router project: git://github.com/tmeasday/meteor-router.git.

The package provides a few features:

1. Define routes using the `Meteor.pages` method.
2. Create before filters that are called before your template is loaded.
3. Use automatically created Handlebars helpers for linking to your pages (like
   Rails path helpers).
4. Stop a route from completing inside a before filter with the `context.stop()`
   method.

###Defining Pages/Routes

```javascript
if (Meteor.isClient) {
 Meteor.pages({
    '/'                 : { to: 'postIndex', nav: 'posts', as: 'root' },
    '/posts'            : { to: 'postIndex', nav: 'posts', as: 'postIndex' },
    '/posts/new'        : { to: 'postForm', nav: 'posts', as: 'postNew' },
    '/posts/:_id'       : { to: 'postShow', nav: 'posts', before: [setPost] },
    '/posts/:_id/edit'  : { to: 'postForm', nav: 'posts', as: 'postEdit', before: [setPost] },
    '/secret'           : { to: 'secret', nav: 'secret', before: [authorize] },
    '/unauthorized'     : 'unauthorized', /* string name of template */
    '*'                 : { to: 'notFound', nav: '', as: 'notFound', layout: 'notFoundLayout' }
  });
}
```

####Route Options

You can just specify the name of the template as a string or you can pass an
object of options. The options are:

* **to**: Name of the template.

* **as**: Optional name of the path helper. Page helpers will have the form
  `<as value>Page` and take a context parameter or use `this` by default. By
  default the path helper will be named the same as the `to` property or
  template name.

* **nav**: Optional `Session` variable to set for use with navigation bars.

* **layout**: Optional template to use as a layout. Defaults to `layout`
  template if it's defined. You can also set this to `false` to not use a
  layout.

* **before**: Optional function or array of functions to be called before the
  template is loaded.

###Creating Before Filters

Before filters are called before the template is loaded. You can use these to
perform authorization, or load a document into Session for example.

Before filters take one parameter: `context`. This object has a `parameters`
property that can be used to get route params and a `stop()` method that can be
used to stop the route from continuing (e.g. if unauthorized).

```javascript
function setPost (context) {
  var _id = context.params._id;
  var post = Posts.findOne(_id);
  if (post)
    Session.set("post", post);
  else
    throw new Error("Post not found with id: " + _id);
}

function authorize(context) {
  // do some authorization
  if (notAuthorized()) {
    context.stop();
    Meteor.go(Meteor.pages.unauthorizedPage());
  }
}

Meteor.pages({
  '/posts/:_id' : { to: 'postShow', before: [authorize, setPost] }
});
```

###Layouts

Layouts let you specify a master template to use as a layout in child templates.

```html
<template name="layout">
  <h1>Master Layout</h1>
  {{yield}}
</template>

<template name="showPost">
  Some content here
</template>
```
Use the `yield` helper to yield the child template.

```javascript
Meteor.pages({
  '/posts/:_id' : { to: 'postShow', layout: 'layout' }
});
```

You can set the `layout` property to `false` or to another layout. By default it
will use `layout` if such a template is defined.

###Page Helpers
For each route, a global Handlebars helper is created. Also, a method is created
in the Meteor.pages namespace. This let's you specify a path in your html
without always having to handle click events just to navigate around the app.

A path helper can take an optional `context` object. By default it will use the
value of `this`. It interpolates the context object with the path. So for
example if you had a path like this:

`/posts/:_id`

And a context object like this:

```javascript
var context = {
  _id: 1234
};
```

You could call the `postShowPage` helper in handlebars or in a function like
this:

```javascript
function someMethod() {
  var path = Meteor.pages.showPostPage(context);
}
```

The context is by default set to `this`...
```html
<a href="{{showPostPage}}">Click Me</a>
```

or if you have a `post` helper method...

```html
<a href="{{showPostPage post}}">Click Me</a>
```
