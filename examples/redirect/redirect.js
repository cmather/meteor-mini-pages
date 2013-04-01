if (Meteor.isClient) {

  Session.set('authorized', false);

  function authorize(){
    if(Session.get('authorized') !== true){
      this.redirect('/');
    }
  }

  Handlebars.registerHelper("navClassFor", function (nav, options) {
    return Meteor.router.navEquals(nav) ? "active" : "";
  });

  Template.layout.events({
    'click .login': function(){
      Session.set('authorized', true);
    },
    'click .logout': function(){
      Session.set('authorized', false);
    }
  });

  Meteor.pages({
    '/': { to: 'home', as: 'root', nav: 'home' },
    '/dashboard': { to: 'dashboard', nav: 'dashboard', before: [authorize] },
  }, {
    defaults: {
      layout: 'layout'
    }
  });
}
