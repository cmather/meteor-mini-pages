if (Meteor.isClient) {

  Session.set("loggingIn", true);

  function setPost () {
    this.set("post", { title: "Post Title Set in Filter" });
  }

  // Reactive before callback
  function secret () {
    if (Session.get("loggingIn")) {
      this.template("loggingIn");
      // you can also call this.layout('..'), this.nav('...')

      // stop the rest of the callbacks from running.
      this.done();
    } else {
      this.set("secret", "You've unlocked the secret!");
    }
  }

  function logout() {
    alert("You're logged out!");
    this.stop();
  }

  Handlebars.registerHelper("navClassFor", function (nav, options) {
    return Meteor.router.navEquals(nav) ? "active" : "";
  });

  Template.postIndex.helpers({
    posts: function () {
      return [{
        _id: 1,
        title: "First Post"
      }];
    }
  });

  Meteor.pages({
    '/': { to: 'postIndex', as: 'root', nav: 'posts' },
    '/posts': { to: 'postIndex', nav: 'posts' },
    '/posts/:_id': { to: 'postShow', before: [setPost] },
    '/secret': { to: 'secret', nav: 'secret', before: secret },
    '/logout': logout,
    '*': 'notFound'
  }, {
    defaults: {
      layout: 'layout'
    }
  });
}
