Posts = new Meteor.Collection("posts");

if (Meteor.isServer) {
  Meteor.startup(function () {
    if (Posts.find().count() > 0) return;

    for (var i = 0; i < 3; i++) {
      Posts.insert({
        title: "Post " + i
      });
    }
  });

  Meteor.publish("posts", function () {
    return Posts.find();
  });
}

if (Meteor.isClient) {
  Meteor.subscribe("posts");

  Meteor.pages({
    '/': { to: 'postIndex', as: 'root', nav: 'posts' },
    '/posts': { to: 'postIndex', nav: 'posts' },
    '/posts/new': { to: 'postForm', nav: 'posts', as: 'postNew', before: [newPost] },
    '/posts/:_id': { to: 'postShow', nav: 'posts', before: [setPost] },
    '/posts/:_id/edit': { to: 'postForm', nav: 'posts', as: 'postEdit', before: [setPost] },
    '/secret': { to: 'secret', nav: 'secret', before: authorize },
    '/login': 'login',
    '*': '404'
  });

  /* before callbacks */
  function setPost (context) {
    var post = Posts.findOne( context.params._id );
    if (post) Session.set("post", post);
  }

  function newPost (context) {
    Session.set("post", {});
  }

  function authorize (context) {
    // fake some authorization here
    if (!Session.get("authorized")) {
      context.redirect(Meteor.loginPath());
    }
  }

  Handlebars.registerHelper("post", function (options) {
    return Session.get("post");
  });

  Handlebars.registerHelper("navClassFor", function (name, options) {
    return Session.equals("nav", name) ? "active" : "";
  });

  Template.postIndex.helpers({
    posts: function () {
      return Posts.find();
    }
  });
}
