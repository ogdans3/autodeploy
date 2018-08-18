var LocalStrategy   = require('passport-local').Strategy;
var User = require("./models/user.js");

// expose this function to our app using module.exports
module.exports = function(passport) {

    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        User.findById(id)
            .then(user => {
                done(null, user);
            })
            .catch(err => {
                done(err);
            })
    });

    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'username',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) {
        User.findOneByUsername(username).then(function(user) {
            // check to see if theres already a user with that email
            if (user) {
                return done(null, false);
            } else {
                // if there is no user with that email create the user
                var newUser = new User(username, User.generateHash(password));

                // save the user
                newUser.save().then(() => {
                    console.log("User saved");
                    return done(null, newUser);
                })
            }

        });    
    }));

};