Posts = new Meteor.Collection('posts');

if (Meteor.isServer) {
  Meteor.publish('posts', function () {
    return Posts.find();
  });

  Meteor.startup(function () {
    if (Posts.find().count() > 0) return;

    for (var i = 0; i < 3; i++) {
      Posts.insert({
        title: "Post " + i
      });
    }
  });
}

if (Meteor.isClient) {
  Meteor.subscribe("posts");

  function setPost(context) {
    var _id = context.params._id;
    var post = Posts.findOne(_id);
    if (post)
      Session.set('post', post);
    else
      throw new Error('Post not found with id: ' + _id);
  }

  function authorize(context) {
    /* simulate a bad authorization */
    
    /* first call stop to stop the route */
    context.stop();

    /* then you can redirect with the 'go' method */
    Meteor.go(Meteor.paths.unauthorizedPath());
  }

  Meteor.pages({
    '/'                 : { to: 'postIndex', nav: 'posts', as: 'root' },
    '/posts'            : { to: 'postIndex', nav: 'posts', as: 'postIndex' },
    '/posts/new'        : { to: 'postForm', nav: 'posts', as: 'postNew' },
    '/posts/:_id'       : { to: 'postShow', nav: 'posts', before: [setPost] },
    '/posts/:_id/edit'  : { to: 'postForm', nav: 'posts', as: 'postEdit', before: [setPost] },
    '/secret'           : { to: 'secret', nav: 'secret', before: [authorize] },
    '/unauthorized'     : { to: 'unauthorized', nav: 'secret' },
    '*'                 : { to: 'notFound', nav: '', as: 'notFound', layout: 'notFoundLayout' }
  });

  Template.postIndex.helpers({
    posts: function () {
      return Posts.find();
    }
  });

  Handlebars.registerHelper('post', function (options) {
    var post;
    if (post = Session.get('post'))
      return post
    else
      throw new Error('no post has been set in session');
  });

  Handlebars.registerHelper('navClassFor', function (nav, options) {
    return Session.equals('currentNav', nav) ?
      "active" : "";
  });
}
