var LocalStrategy   = require('passport-local').Strategy;
var User = require("./models/user.js");

// expose this function to our app using module.exports
module.exports = function(passport) {
    passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'username',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) { 
        // find a user whose email is the same as the forms email
        // we are checking to see if the user trying to login already exists
        User.findOne({username: username})
            .then(user => {
                console.log("User: ", user);
                // if no user is found, return the message
                if (!user)
                    return done(null, false); 

                // if the user is found but the password is wrong
                if (!user.validPassword(password))
                    return done(null, false); // create the loginMessage and save it to session as flashdata

                // all is well, return successful user
                return done(null, user);
            })
            .catch(err => {
                console.log("ERROR: ", err);
                // if there are any errors, return the error before anything else
                if (err)
                    return done(err);
            })

    }));
};