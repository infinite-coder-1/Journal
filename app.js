require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const lodash = require("lodash");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const date = require(__dirname + "/date.js");


mongoose.connect("mongodb://localhost:27017/postsdb");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const postSchema = new mongoose.Schema({
  name: String,
  content: String,
  date: String,
});

const Posts = mongoose.model("post", postSchema);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  posts: [postSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:2000/auth/google/home",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {

    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
  if(req.isAuthenticated()){
    res.redirect("/home");
  }
  else{
    res.render("main");
  }
});

app.get("/auth/google",
  passport.authenticate('google', {
    scope: ["profile"]
  })
);

app.get("/auth/google/home",
  passport.authenticate('google', {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/home");
  });

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});


app.get("/home", function(req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          res.render("home", {
            entries: foundUser.posts
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }

});

app.get("/about", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("about");
  } else {
    res.redirect("/login");
  }

});

app.get("/contact", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("contact");
  } else {
    res.redirect("/login");
  }

});

app.get("/compose", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("compose");
  } else {
    res.redirect("/login");
  }
});



//add post
app.post("/compose", function(req, res) {
  const post = new Posts({
    name: lodash.capitalize(req.body.postTitle),
    content: req.body.postBody,
    date: date.getDate()
  });
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.posts.push(post);
        foundUser.save(function() {
          res.redirect("/home");
        });
      }
    }
  });

});

//show complete post
app.get("/posts/:postID", function(req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
           foundUser.posts.forEach(function(entry){
             if(entry.id===req.params.postID){
               res.render("post", {
                 postName: entry.name,
                 postDate: entry.date,
                 postContent: entry.content,
                 postId: entry.id
               });

             }
           });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});


//delete post
app.post("/delete", function(req, res) {
  var deleteId = req.body.button;
  console.log(req.user.id);
  User.updateOne({_id: req.user.id}, {"$pull":{"posts":{"_id": deleteId}}}, function(err, obj){
    if(err){
      console.log(err);
    }
    else{
      console.log(obj);
    }
  });
  res.redirect("/home");
});

//register
app.post("/register", function(req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/home");
      });
    }
  });

});

//login
app.post("/login", function(req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/home");
      });
    }
  });

});

//logout
app.get("/logout", function(req, res) {
  req.logout(function(err) {
    if (!err) {
      res.redirect("/");
    }
  });

});


app.listen(2000, function() {
  console.log("Server started on port 2000");
});
